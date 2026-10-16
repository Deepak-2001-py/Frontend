import json
import os
import boto3
import jwt
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
import datetime

# Helper class for JSON serialization of Decimal and datetime
class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('assignment_grading')  # Replace with your actual table name

# ----------------------------------------------------------------------
# JWT authentication / authorization
#
# SECURITY: this endpoint used to trust student_id/qp_id straight from
# the request body with no check at all — any caller could read any
# student's grades (or the whole class roster) just by changing the IDs
# in the request/URL. Every operation now requires a valid
# Authorization: Bearer <token> (issued by lambda_python_files/
# authetication.py's generate_token()) and:
#   - a "student" caller may only ever fetch their OWN student_id
#   - "getAllStudentGrades" (the whole-class roster) is teacher/admin only
#
# JWT_SECRET must be the SAME value as the auth Lambda's JWT_SECRET env
# var — these are two separate Lambda deployments that have to agree on
# how tokens are signed. This Lambda also needs API Gateway configured
# with Lambda **proxy** integration, since a custom/non-proxy mapping
# template that only forwards the JSON body will drop the Authorization
# header before it ever reaches this function, and every request will
# fail with 401.
#
# The token payload only carries user_id/email (see authetication.py's
# generate_token) — not role — so role is looked up fresh from the Users
# table on every request instead of trusted from the token. That also
# means revoking/demoting a user takes effect immediately rather than
# waiting for their token to expire.
# ----------------------------------------------------------------------

JWT_SECRET = os.environ.get('JWT_SECRET', '23042db269fe61ae30aeb5a3dbf4a276616f464858094dc2eac57dd5dc5ada7e')
users_table = dynamodb.Table(os.environ.get('USER_TABLE_NAME', 'Users'))


class AuthError(Exception):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def authenticate(event):
    """Verifies the bearer token and returns {'user_id', 'email', 'role'}.
    Raises AuthError (401) if it's missing, malformed, expired, or the
    account it names no longer exists."""
    headers = event.get('headers') or {}
    auth_header = headers.get('Authorization') or headers.get('authorization') or ''
    if not auth_header.startswith('Bearer '):
        raise AuthError(401, 'Missing Authorization: Bearer <token> header.')

    token = auth_header[len('Bearer '):].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise AuthError(401, 'Session expired — please log in again.')
    except jwt.InvalidTokenError:
        raise AuthError(401, 'Invalid session token.')

    email = payload.get('email')
    user_id = payload.get('user_id')
    if not email or not user_id:
        raise AuthError(401, 'Malformed session token.')

    user = users_table.get_item(Key={'email': email}).get('Item')
    if not user or user.get('user_id') != user_id:
        raise AuthError(401, 'Account no longer exists.')

    return {'user_id': user_id, 'email': email, 'role': user.get('userRole', 'student')}


def create_response(status_code, body):
    """Standardized API response — every response (success or error) needs
    these CORS headers or the browser never sees the error message."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        'body': json.dumps(body, cls=JSONEncoder),
    }


def lambda_handler(event, context):
    """
    Lambda handler to retrieve student grades from DynamoDB

    Parameters:
    - event: API Gateway proxy event. The Authorization header is read
      from event['headers'], and the operation payload from
      json.loads(event['body']) (falls back to treating `event` itself
      as the payload, for compatibility with a non-proxy integration —
      though non-proxy integrations can't carry the Authorization header
      at all, see the module docstring above).
    - context: Lambda context

    Event body for a single student:
    {
        "operation": "getSingleStudentGrade",
        "student_id": "student123",
        "assignment_id": "assignment456"
    }

    Event body for all students (teacher/admin only):
    {
        "operation": "getAllStudentGrades",
        "qp_id": "qp789",
        "assignment_id": "assignment456"
    }
    """
    if event.get('httpMethod') == 'OPTIONS':
        return create_response(200, {'message': 'CORS preflight successful'})

    try:
        print(event)

        if 'body' in event and event['body']:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event

        caller = authenticate(event)

        operation = body.get('operation')

        if operation == 'getSingleStudentGrade':
            return get_single_student_grade(body, caller)
        elif operation == 'getAllStudentGrades':
            return get_all_student_grades(body, caller)
        elif operation == 'updateStudentGrade':
            return update_student_grade(body, caller)
        else:
            return create_response(400, {'error': 'Invalid operation specified'})

    except AuthError as e:
        return create_response(e.status_code, {'error': e.message})
    except Exception as e:
        return create_response(500, {'error': str(e)})

def convert_decimal(obj):
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

def update_student_grade(body, caller):
    """
    Update only the Total Marks for a student given student_id, qp_id, and type.
    Teacher/admin only — a student must never be able to set their own marks.
    """
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': "Only a teacher or admin can update grades."})

    student_id = body.get('student_id')
    qp_id = body.get('qp_id')
    type_ = "summary"
    total_marks = body.get('total_marks')

    if not all([student_id, qp_id, type_, total_marks]):
        return create_response(400, {'error': 'student_id, qp_id, type, and total_marks are required'})

    try:

        response = table.query(
            IndexName='student_id-index',
            KeyConditionExpression=Key('student_id').eq(student_id),
            FilterExpression= Attr('type').eq('summary')
        )
        print(response)
        # Filter by qp_id and type
        item = next((i for i in response['Items'] if i['qp_id'] == qp_id and i['type'] == type_), None)
        if item:
            # A record that already has an owning teacher_id can only be
            # touched by that teacher (or an admin) — see the note in
            # get_all_student_grades() about why this is best-effort until
            # every record in the table has been backfilled with one.
            existing_owner = item.get('teacher_id')
            if existing_owner and caller['role'] != 'admin' and existing_owner != caller['user_id']:
                return create_response(403, {'error': "This assignment belongs to a different teacher."})

            table.update_item(
                Key={'evaluation_id': item['evaluation_id']},
                UpdateExpression="SET total_marks = :tm, teacher_id = :tid",
                ExpressionAttributeValues={':tm': total_marks, ':tid': caller['user_id']},
                ReturnValues="ALL_NEW"
            )

            return create_response(200, {'message': 'Total marks updated successfully', 'updatedAttributes': convert_decimal(response.get('Items'))})

    except Exception as e:
        return create_response(500, {'error': str(e)})



def get_single_student_grade(body, caller):
    """Get grades for a single student based on student_id and assignment_id.
    A student caller may only ever fetch their own student_id — this is
    the check that stops one student from reading another's results by
    editing the request (e.g. the student_id query param/form field)."""
    student_id = body.get('student_id')
    assignment_id = body.get('assignment_id')

    if not student_id or not assignment_id:
        return create_response(400, {'error': 'Missing required parameters: student_id and assignment_id'})

    if caller['role'] == 'student' and student_id != caller['user_id']:
        return create_response(403, {'error': "You can only view your own grades."})

    summary_response = table.query(
    IndexName='student_id-index',
    KeyConditionExpression=Key('student_id').eq(student_id),
    FilterExpression=Attr('assignment_id').eq(assignment_id)& Attr('type').ne('summary')   # Include 'type' in KeyConditionExpression
    )

    # Query for detailed results (per question)
    details_response = table.query(
        IndexName='student_id-index',  # Same GSI as above
        KeyConditionExpression=Key('student_id').eq(student_id) ,
        FilterExpression=Attr('type').eq('summary')& Attr('assignment_id').eq(assignment_id)
    )

    # A teacher (not admin) may only see a record that's unowned or
    # already theirs — see get_all_student_grades() for why this is
    # best-effort rather than a hard guarantee across the whole table.
    if caller['role'] == 'teacher':
        owner_ids = {item.get('teacher_id') for item in details_response.get('Items', []) if item.get('teacher_id')}
        if owner_ids and caller['user_id'] not in owner_ids:
            return create_response(403, {'error': "This student's results belong to a different teacher's class."})

    # Format response
    response = {
        'student_id': student_id,
        'assignment_id': assignment_id,
        'details': summary_response.get('Items', []),
        'summary':  details_response.get('Items', [])
    }

    return create_response(200, response)

def get_all_student_grades(body, caller):
    """Get grades for all students based on qp_id and assignment_id.
    Teacher/admin only — this returns an entire class roster, which a
    student must never be able to browse by guessing/editing qp_id."""
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': "Only a teacher or admin can view a class roster."})

    qp_id = body.get('qp_id')
    assignment_id = body.get('assignment_id')

    if not qp_id or not assignment_id:
        return create_response(400, {'error': 'Missing required parameters: qp_id and assignment_id'})

    # Get only summary records for an assignment
    response = table.query(
        IndexName='type-index',
        KeyConditionExpression= Key('type').eq('summary'), # Ensure 'type' is included
        FilterExpression=Attr('assignment_id').eq(assignment_id)& Attr('qp_id').eq(qp_id),

    )
    grades = response.get('Items', [])

    # Best-effort teacher-to-teacher isolation: filter out any record that
    # already names a *different* teacher as its owner. This can't be a
    # hard guarantee yet because these records don't all carry a
    # teacher_id today — only ones written/touched through
    # update_student_grade() / lambda_python_files/update_db.py's
    # updateMarks (after this security pass) get stamped with one. Once
    # every row has been backfilled with its owning teacher_id, this
    # should be tightened to also exclude ownerless rows for non-admins.
    if caller['role'] == 'teacher':
        grades = [g for g in grades if not g.get('teacher_id') or g.get('teacher_id') == caller['user_id']]

    # Format response
    result = {
        'qp_id': qp_id,
        'assignment_id': assignment_id,
        'student_count': len(grades),
        'grades': grades
    }

    return create_response(200, result)
