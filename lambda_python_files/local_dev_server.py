"""
Local dev backend — runs the real Lambda handlers in this repo against an
in-memory DynamoDB (moto), seeded with demo users and one graded assignment,
so the React app in web/ can be used end to end without AWS.

    pip install -r lambda_python_files/requirements-dev.txt
    python lambda_python_files/local_dev_server.py          # http://localhost:8787
    # in web/.env.local:  VITE_API_BASE_URL=http://localhost:8787

Demo logins (password for all: Password123!):
    admin@gradeant.dev   (admin)
    teacher@gradeant.dev (teacher)
    riya@gradeant.dev, sam@gradeant.dev, li@gradeant.dev (students, class PHY-204)

Routes → handlers: /auth/* → authetication.py, /getgrades → get_grades.py,
/correctanswer → correct_questions_answer.py, /updatedb → update_db.py,
/admin → ../admin/lambda_admin.py, /workflow → workflow.py. /uploadpdf (the
presign Lambda isn't in this repo) is stubbed: uploads are accepted and
discarded. Data lives in memory and resets on restart. The GradeFlow
assistant answers with a canned reply unless USE_BEDROCK=1 (then it calls
Claude on Amazon Bedrock with your AWS credentials).
"""
import importlib
import json
import os
import sys
import time
import uuid
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', '8787'))
HERE = os.path.dirname(os.path.abspath(__file__))
SECRET = 'local-dev-secret-local-dev-secret-0123456789'
PASSWORD = 'Password123!'

os.environ.update({
    'JWT_SECRET': SECRET,
    'SESSION_TOKEN_SECRET': SECRET,
    'AWS_DEFAULT_REGION': 'us-east-1',
    'AWS_ACCESS_KEY_ID': 'local',
    'AWS_SECRET_ACCESS_KEY': 'local',
    'USERS_TABLE': 'GradeAnt_Users',
    'LOGIN_USERS_TABLE': 'Users',
})
os.environ.pop('AWS_LAMBDA_FUNCTION_NAME', None)

from moto import mock_aws  # noqa: E402

mock = mock_aws()
mock.start()

import boto3  # noqa: E402

ddb = boto3.resource('dynamodb', region_name='us-east-1')


def table(name, *keys, gsis=()):
    attrs = {k for k, _ in keys} | {k for _, gk in gsis for k in gk}
    ddb.create_table(
        TableName=name, BillingMode='PAY_PER_REQUEST',
        KeySchema=[{'AttributeName': k, 'KeyType': t} for k, t in keys],
        AttributeDefinitions=[{'AttributeName': a, 'AttributeType': 'S'} for a in sorted(attrs)],
        **({'GlobalSecondaryIndexes': [
            {'IndexName': n, 'KeySchema': [{'AttributeName': gk[0], 'KeyType': 'HASH'}], 'Projection': {'ProjectionType': 'ALL'}}
            for n, gk in gsis]} if gsis else {}),
    )


table('Users', ('email', 'HASH'))
table('assignment_grading', ('evaluation_id', 'HASH'),
      gsis=[('student_id-index', ('student_id',)), ('type-index', ('type',)), ('assignment_id-index', ('assignment_id',))])
table('GradeAnt_Assignments', ('assignment_id', 'HASH'), gsis=[('teacher_id-index', ('teacher_id',))])
table('GradeAnt_Submissions', ('assignment_id', 'HASH'), ('student_id', 'RANGE'), gsis=[('student_id-index', ('student_id',))])
table('GradeAnt_Announcements', ('announcement_id', 'HASH'))
for name, pk in [('GradeAnt_Users', 'user_id'), ('GradeAnt_ResetRequests', 'request_id'), ('GradeAnt_Content', 'post_id'),
                 ('GradeAnt_Tickets', 'ticket_id'), ('GradeAnt_AuditLogs', 'log_id'), ('GradeAnt_Settings', 'setting_key'),
                 ('GradeAnt_Invites', 'token'), ('GradeAnt_Analytics', 'metric_key')]:
    table(name, (pk, 'HASH'))

sys.path[:0] = [HERE, os.path.join(HERE, '..', 'admin')]
HANDLERS = {
    '/auth': importlib.import_module('authetication'),
    '/getgrades': importlib.import_module('get_grades'),
    '/correctanswer': importlib.import_module('correct_questions_answer'),
    '/updatedb': importlib.import_module('update_db'),
    '/admin': importlib.import_module('lambda_admin'),
    '/workflow': importlib.import_module('workflow'),
}

if os.environ.get('USE_BEDROCK') != '1':
    def _canned(system, messages, *, effort, max_tokens=16000, output_format=None):
        if output_format:
            return None  # keep the default rubric
        return '(Local dev server — Claude is not called. Set USE_BEDROCK=1 to use Amazon Bedrock.)'
    HANDLERS['/workflow']._ask_claude = _canned


# ---- Seed data ------------------------------------------------------------

def seed():
    import base64
    auth = HANDLERS['/auth']
    people = [
        ('A1', 'admin@gradeant.dev', 'Alex Morgan', 'admin', None),
        ('T1', 'teacher@gradeant.dev', 'Dr. Priya Nair', 'teacher', None),
        ('S1', 'riya@gradeant.dev', 'Riya Sharma', 'student', ['PHY-204']),
        ('S2', 'sam@gradeant.dev', 'Sam Okafor', 'student', ['PHY-204']),
        ('S3', 'li@gradeant.dev', 'Li Wei', 'student', ['PHY-204']),
    ]
    now = time.strftime('%Y-%m-%dT%H:%M:%S')
    for uid, email, name, role, classes in people:
        item = {'user_id': uid, 'email': email, 'name': name, 'userRole': role,
                'password': base64.b64encode(auth.hash_password(PASSWORD)).decode(), 'created_at': now, 'updated_at': now}
        if classes:
            item['classes'] = classes
        ddb.Table('Users').put_item(Item=item)
        ddb.Table('GradeAnt_Users').put_item(Item={'user_id': uid, 'email': email, 'name': name, 'role': role,
                                                   'status': 'active', 'createdAt': now, 'school': 'Lincoln HS'})

    a_id, qp = 'A-thermo', 'QP-thermo'
    ddb.Table('GradeAnt_Assignments').put_item(Item={
        'assignment_id': a_id, 'qp_id': qp, 'title': 'Thermodynamics HW', 'class_name': 'PHY-204', 'teacher_id': 'T1',
        'method': 'standard', 'persona': 'balanced', 'partial_credit': True,
        'qp_status': 'rubric_reviewed', 'content_status': 'published', 'grades_status': 'teacher_reviewing', 'created_at': now,
        'rubric': [{'question_number': 1, 'max_marks': 5, 'title': 'Internal energy', 'criteria': 'Defines U as the total energy of the system; unit J.'},
                   {'question_number': 2, 'max_marks': 5, 'title': 'First law', 'criteria': 'ΔU = Q − W with a stated sign convention.'},
                   {'question_number': 3, 'max_marks': 10, 'title': 'Isothermal work', 'criteria': 'W = nRT ln(V2/V1) ≈ 1729 J; correct sign and units.'}],
        'due_at': time.strftime('%Y-%m-%d', time.localtime(time.time() + 3 * 86400)),
    })
    questions = [
        (1, 'Define internal energy and state its SI unit.', 5),
        (2, 'State the first law of thermodynamics for a closed system.', 5),
        (3, 'Calculate the work done in an isothermal expansion of 1 mol of ideal gas from 1 L to 2 L at 300 K.', 10),
    ]
    results = {  # student -> per-question (marks, answer, feedback, confidence)
        'S1': [(5, 'U is the total energy of the system; unit J.', 'Correct.', 0.97),
               (4, 'dU = Q - W', 'Right relation; state the sign convention.', 0.95),
               (9, 'W = nRT ln(V2/V1) = 1729 J', 'Good — units clear.', 0.93)],
        'S2': [(3, 'energy inside', 'Missing the SI unit.', 0.9),
               (5, 'ΔU = Q − W for a closed system', 'Correct.', 0.96),
               (4, 'W = 8.314*300*ln2 = 1.7 kJ (sign?)', 'Method right; sign of work unclear.', 0.61)],
    }
    ddb.Table('GradeAnt_Announcements').put_item(Item={
        'announcement_id': 'N-welcome', 'class_name': 'PHY-204', 'title': 'Welcome to PHY-204',
        'message': 'Thermodynamics HW is open. Photograph every page of your working and upload it before the due date.',
        'author_id': 'T1', 'author_name': 'Dr. Priya Nair', 'created_at': now,
    })
    t = ddb.Table('assignment_grading')
    ts = int(time.time()) - 3600
    for sid, rows in results.items():
        for (qn, qtext, mm), (marks, ans, fb, conf) in zip(questions, rows):
            t.put_item(Item={
                'evaluation_id': f'{sid}-{qn}-{uuid.uuid4().hex[:6]}', 'student_id': sid, 'assignment_id': a_id, 'qp_id': qp,
                'type': 'detail', 'question_number': qn, 'question': qtext, 'max_marks': mm, 'marks': marks,
                'student_answer': ans, 'feedback': fb, 'confidence': Decimal(str(conf)), 'status': 'corrected',
                'teacher_id': 'T1', 'timestamp': ts,
            })
        t.put_item(Item={'evaluation_id': f'{sid}-summary', 'student_id': sid, 'assignment_id': a_id, 'qp_id': qp, 'type': 'summary',
                         'total_marks': sum(r[0] for r in rows), 'teacher_id': 'T1', 'timestamp': ts})


seed()


# ---- HTTP -----------------------------------------------------------------

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, headers=None):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(status)
        for k, v in {**CORS, 'Content-Type': 'application/json', **(headers or {})}.items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_PUT(self):  # stubbed S3 upload target
        self.rfile.read(int(self.headers.get('Content-Length') or 0))
        self._send(200, b'')

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode() or '{}'
        path = self.path.split('?')[0]
        if path == '/uploadpdf':
            files = json.loads(raw).get('files', [])
            urls = [f'http://localhost:{PORT}/s3/{uuid.uuid4().hex}/{f.get("name", "file")}' for f in files]
            return self._send(200, json.dumps({'urls': urls}))
        module = next((m for prefix, m in HANDLERS.items() if path == prefix or path.startswith(prefix + '/')), None)
        if not module:
            return self._send(403, json.dumps({'message': 'Missing Authentication Token'}))
        event = {'httpMethod': 'POST', 'path': path, 'resource': path, 'body': raw,
                 'headers': {k: v for k, v in self.headers.items()}, 'requestContext': {}}
        res = module.lambda_handler(event, None) or {}
        body = res.get('body', '')
        self._send(int(res.get('statusCode', 200)), body if isinstance(body, str) else json.dumps(body))

    def log_message(self, fmt, *args):
        sys.stderr.write('[api] ' + fmt % args + '\n')


if __name__ == '__main__':
    print(f'GradeAnt local backend on http://localhost:{PORT}  (password for demo users: {PASSWORD})')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
