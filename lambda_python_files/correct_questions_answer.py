import json
import os
import boto3
import jwt
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
import datetime
from botocore.exceptions import ClientError

# ----------------------------------------------------------------------
# λ correction API — GradeAnt Schema & AWS Flow Wireframes.html, flows C
# (QUESTION_PAPERS, teacher side) and D (SUBMISSIONS, student side).
#
# This backend doesn't run Textract/Bedrock yet, and there's no separate
# QUESTION_PAPERS / SUBMISSIONS table — everything lives in the single
# `assignment_grading` table (see lambda_python_files/update_db.py and
# get_grades.py), one item per question per student, keyed by
# evaluation_id, plus one "summary" item per student carrying
# total_marks. The `question` and `student_answer` fields already read by
# javascript/view_grades.js / student_grade.js are exactly the wireframe's
# qpParsedS3Key/parsed.json ("questionText") and ocrTextS3Key/ocr.json
# ("rawOcrText") payloads, just stored inline on the DynamoDB item instead
# of pointed to in S3.
#
# So "correction" here means: after upload + OCR populates `question` /
# `student_answer` on these items, let the owning student fix their own
# OCR'd answer text (wireframe status ocr_done -> corrected, §D④) and let
# the owning teacher fix the parsed question text (wireframe status
# qp_parsed -> rubric_reviewed, §C⑥) — both accepting either plain text or
# LaTeX (is_latex flag; javascript/*.js's renderContent()/loadMathJax()
# already render LaTeX wherever `question`/`student_answer` are shown).
#
# `question` is denormalized onto every student's row for a given
# question_number (wireframe: "DynamoDB update (denormalized questionText
# for list views)"), so a teacher's question-text correction fans out to
# every student's row for that qp_id/question_number — see
# submitQuestionCorrections() below.
#
# JWT_SECRET / USER_TABLE_NAME / table name match update_db.py and
# get_grades.py exactly — these are separate Lambda deployments that must
# agree on how tokens are signed and where users/grades live. Needs API
# Gateway with Lambda **proxy** integration so the Authorization header
# reaches this function (see update_db.py's module docstring).
# ----------------------------------------------------------------------


class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super(JSONEncoder, self).default(obj)


dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('assignment_grading')  # Replace with your actual table name

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
    """Create a standardized API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(body, cls=JSONEncoder)
    }


def convert_decimal(obj):
    """Convert DynamoDB Decimal objects to Python numbers"""
    if isinstance(obj, list):
        return [convert_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


def lambda_handler(event, context):
    """
    Lambda handler for the post-upload correction workspace:
      - getAnswersForCorrection / submitAnswerCorrections  (student side)
      - getQuestionsForCorrection / submitQuestionCorrections (teacher side)
    """
    if event.get('httpMethod') == 'OPTIONS':
        return create_response(200, {'message': 'CORS preflight successful'})

    try:
        print(f"Received event: {json.dumps(event, indent=2)}")

        if 'body' in event and event['body']:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event

        caller = authenticate(event)

        operation = body.get('operation')

        if operation == 'getAnswersForCorrection':
            return get_answers_for_correction(body, caller)
        elif operation == 'submitAnswerCorrections':
            return submit_answer_corrections(body, caller)
        elif operation == 'getQuestionsForCorrection':
            return get_questions_for_correction(body, caller)
        elif operation == 'submitQuestionCorrections':
            return submit_question_corrections(body, caller)
        else:
            return create_response(400, {'error': 'Invalid operation specified'})

    except AuthError as e:
        return create_response(e.status_code, {'error': e.message})
    except json.JSONDecodeError as e:
        return create_response(400, {'error': f'Invalid JSON format: {str(e)}'})
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return create_response(500, {'error': f'Internal server error: {str(e)}'})


# ----------------------------------------------------------------------
# Student side — wireframe §D③ ocr_done -> §D④ corrected
# ----------------------------------------------------------------------

def get_answers_for_correction(body, caller):
    """
    Fetch this student's own per-question rows (OCR'd question + answer
    text) for one assignment so they can review/correct the answer text
    before grading runs.

    Request: { operation, student_id, assignment_id, qp_id? }
    A student may only ever fetch their own student_id — mirrors the same
    check in get_grades.py's get_single_student_grade.
    """
    student_id = body.get('student_id')
    assignment_id = body.get('assignment_id')
    qp_id = body.get('qp_id')

    if not student_id or not assignment_id:
        return create_response(400, {'error': 'student_id and assignment_id are required'})

    if caller['role'] == 'student' and student_id != caller['user_id']:
        return create_response(403, {'error': 'You can only view your own answers.'})

    try:
        filter_expr = Attr('assignment_id').eq(assignment_id) & Attr('type').ne('summary')
        if qp_id:
            filter_expr = filter_expr & Attr('qp_id').eq(qp_id)

        response = table.query(
            IndexName='student_id-index',
            KeyConditionExpression=Key('student_id').eq(student_id),
            FilterExpression=filter_expr
        )
        items = response.get('Items', [])

        # A teacher (not admin) may only browse a submission that's unowned
        # or already theirs — same best-effort check as get_grades.py.
        if caller['role'] == 'teacher':
            owner_ids = {item.get('teacher_id') for item in items if item.get('teacher_id')}
            if owner_ids and caller['user_id'] not in owner_ids:
                return create_response(403, {'error': "This student's answers belong to a different teacher's class."})

        answers = [{
            'evaluation_id': item.get('evaluation_id'),
            'question_number': item.get('question_number'),
            'subpart': item.get('subpart'),
            'question': item.get('question'),
            'student_answer': item.get('student_answer'),
            'is_latex': item.get('is_latex', False),
            'max_marks': item.get('max_marks'),
            'status': item.get('status'),
            'corrected_by': item.get('corrected_by'),
            'corrected_at': item.get('corrected_at'),
        } for item in items]

        answers.sort(key=lambda a: (str(a.get('question_number') or ''), str(a.get('subpart') or '')))

        return create_response(200, {
            'student_id': student_id,
            'assignment_id': assignment_id,
            'qp_id': qp_id,
            'answers': convert_decimal(answers)
        })
    except Exception as e:
        print(f"Error in get_answers_for_correction: {str(e)}")
        return create_response(500, {'error': str(e)})


def submit_answer_corrections(body, caller):
    """
    Student submits corrected answer text (plain or LaTeX) for one or more
    of their own questions. Sets status='corrected' so the grading fan-in
    gate (wireframe §D, "◆ FAN-IN GATE") can pick it up.

    Request:
    { operation, corrections: [ { evaluation_id, question_number,
        corrected_answer, is_latex? } ] }
    """
    if caller['role'] != 'student':
        return create_response(403, {'error': 'Only the student who owns this submission can correct it.'})

    corrections = body.get('corrections')
    if not corrections or not isinstance(corrections, list):
        return create_response(400, {'error': 'corrections (non-empty array) is required'})

    updated_items = []
    errors = []
    now = datetime.datetime.utcnow().isoformat()

    for correction in corrections:
        evaluation_id = correction.get('evaluation_id')
        question_number = correction.get('question_number')
        corrected_answer = correction.get('corrected_answer')
        is_latex = bool(correction.get('is_latex', False))

        if not evaluation_id:
            errors.append('Missing evaluation_id in correction')
            continue
        if question_number is None:
            errors.append(f'Missing question_number for evaluation_id {evaluation_id}')
            continue
        if corrected_answer is None or str(corrected_answer).strip() == '':
            errors.append(f'corrected_answer is required for evaluation_id {evaluation_id}')
            continue

        try:
            # Only the owning student may correct their own answer — a
            # record naming a different student_id is never touched here.
            existing = table.get_item(Key={'evaluation_id': evaluation_id}).get('Item')
            if not existing:
                errors.append(f'No record found with evaluation_id {evaluation_id}')
                continue
            if existing.get('student_id') != caller['user_id']:
                errors.append(f'evaluation_id {evaluation_id} belongs to a different student.')
                continue

            table.update_item(
                Key={'evaluation_id': evaluation_id},
                UpdateExpression=(
                    "SET student_answer = :sa, is_latex = :il, #st = :status, "
                    "corrected_by = :cb, corrected_at = :ca, updated_at = :ua"
                ),
                ExpressionAttributeNames={'#st': 'status'},
                ExpressionAttributeValues={
                    ':sa': corrected_answer,
                    ':il': is_latex,
                    ':status': 'corrected',
                    ':cb': caller['user_id'],
                    ':ca': now,
                    ':ua': now,
                },
                ConditionExpression=Attr('question_number').eq(question_number),
                ReturnValues="UPDATED_NEW"
            )

            updated_items.append({
                'evaluation_id': evaluation_id,
                'question_number': question_number,
                'updated': True,
                'is_latex': is_latex,
            })
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                errors.append(f'No matching question_number {question_number} for evaluation_id {evaluation_id}')
            else:
                errors.append(f"Database error for evaluation_id {evaluation_id}: {e.response['Error']['Message']}")
        except Exception as e:
            errors.append(f'Failed to correct evaluation_id {evaluation_id}: {str(e)}')

    response_data = {
        'message': 'Correction completed' if not errors else 'Correction completed with some errors',
        'updated_items': updated_items,
        'total_updated': len(updated_items),
        'success': len(errors) == 0,
    }
    if errors:
        response_data['errors'] = errors

    if len(updated_items) == 0:
        response_data['message'] = 'No answers were corrected'
        return create_response(404, response_data)

    status_code = 200 if not errors else 207
    return create_response(status_code, response_data)


# ----------------------------------------------------------------------
# Teacher side — wireframe §C③ qp_parsed -> §C⑥ rubric_reviewed
# ----------------------------------------------------------------------

def _class_roster(qp_id, assignment_id):
    """Every student's summary row for a qp_id/assignment_id — same
    type-index query as get_grades.py's get_all_student_grades()."""
    response = table.query(
        IndexName='type-index',
        KeyConditionExpression=Key('type').eq('summary'),
        FilterExpression=Attr('assignment_id').eq(assignment_id) & Attr('qp_id').eq(qp_id),
    )
    return response.get('Items', [])


def get_questions_for_correction(body, caller):
    """
    Fetch one canonical copy of each question's parsed text for a qp_id, so
    the teacher can review/correct it once rather than per-student. `question`
    is denormalized onto every student's row, so this reads the first
    student's rows found as the representative copy — same N+1-by-roster
    pattern javascript/teacher_correction.js already uses client-side,
    just consolidated server-side here.

    Request: { operation, qp_id, assignment_id }
    """
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': 'Only a teacher or admin can review question text.'})

    qp_id = body.get('qp_id')
    assignment_id = body.get('assignment_id')
    if not qp_id or not assignment_id:
        return create_response(400, {'error': 'qp_id and assignment_id are required'})

    try:
        roster = _class_roster(qp_id, assignment_id)

        if caller['role'] == 'teacher':
            roster = [g for g in roster if not g.get('teacher_id') or g.get('teacher_id') == caller['user_id']]

        if not roster:
            return create_response(200, {'qp_id': qp_id, 'assignment_id': assignment_id, 'questions': []})

        questions_by_key = {}
        for student in roster:
            student_id = student.get('student_id')
            if not student_id:
                continue
            details = table.query(
                IndexName='student_id-index',
                KeyConditionExpression=Key('student_id').eq(student_id),
                FilterExpression=Attr('assignment_id').eq(assignment_id) & Attr('qp_id').eq(qp_id) & Attr('type').ne('summary'),
            ).get('Items', [])

            for item in details:
                key = (str(item.get('question_number')), item.get('subpart') or '')
                if key not in questions_by_key:
                    questions_by_key[key] = {
                        'question_number': item.get('question_number'),
                        'subpart': item.get('subpart'),
                        'question': item.get('question'),
                        'is_latex': item.get('question_is_latex', False),
                        'max_marks': item.get('max_marks'),
                        'question_reviewed': bool(item.get('question_reviewed_at')),
                        'question_reviewed_by': item.get('question_reviewed_by'),
                        'question_reviewed_at': item.get('question_reviewed_at'),
                    }
            # One representative student's rows are enough — question text
            # is denormalized identically across the class before review.
            if questions_by_key:
                break

        questions = sorted(
            questions_by_key.values(),
            key=lambda q: (str(q.get('question_number') or ''), str(q.get('subpart') or ''))
        )

        return create_response(200, {
            'qp_id': qp_id,
            'assignment_id': assignment_id,
            'questions': convert_decimal(questions)
        })
    except Exception as e:
        print(f"Error in get_questions_for_correction: {str(e)}")
        return create_response(500, {'error': str(e)})


def submit_question_corrections(body, caller):
    """
    Teacher submits corrected question text (plain or LaTeX) for one or
    more questions in a qp_id. Since `question` is denormalized onto every
    student's row (wireframe: "denormalized questionText for list views"),
    each correction fans out to every matching row in the class roster —
    this is the write-side counterpart of get_questions_for_correction()'s
    read fan-in.

    Request:
    { operation, qp_id, assignment_id,
      corrections: [ { question_number, subpart?, corrected_question,
                        is_latex? } ] }
    """
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': 'Only a teacher or admin can correct question text.'})

    qp_id = body.get('qp_id')
    assignment_id = body.get('assignment_id')
    corrections = body.get('corrections')

    if not qp_id or not assignment_id:
        return create_response(400, {'error': 'qp_id and assignment_id are required'})
    if not corrections or not isinstance(corrections, list):
        return create_response(400, {'error': 'corrections (non-empty array) is required'})

    try:
        roster = _class_roster(qp_id, assignment_id)
    except Exception as e:
        print(f"Error loading roster in submit_question_corrections: {str(e)}")
        return create_response(500, {'error': str(e)})

    now = datetime.datetime.utcnow().isoformat()
    updated_questions = []
    errors = []

    for correction in corrections:
        question_number = correction.get('question_number')
        subpart = correction.get('subpart')
        corrected_question = correction.get('corrected_question')
        is_latex = bool(correction.get('is_latex', False))

        if question_number is None:
            errors.append('Missing question_number in correction')
            continue
        if corrected_question is None or str(corrected_question).strip() == '':
            errors.append(f'corrected_question is required for question_number {question_number}')
            continue

        records_updated = 0
        for student in roster:
            student_id = student.get('student_id')
            if not student_id:
                continue

            # A student's rows already owned by a different teacher are
            # skipped rather than overwritten — same best-effort isolation
            # as update_db.py's ownership checks.
            existing_owner = student.get('teacher_id')
            if existing_owner and caller['role'] != 'admin' and existing_owner != caller['user_id']:
                continue

            try:
                details = table.query(
                    IndexName='student_id-index',
                    KeyConditionExpression=Key('student_id').eq(student_id),
                    FilterExpression=(
                        Attr('assignment_id').eq(assignment_id)
                        & Attr('qp_id').eq(qp_id)
                        & Attr('question_number').eq(question_number)
                        & Attr('type').ne('summary')
                    ),
                ).get('Items', [])

                for item in details:
                    if subpart and item.get('subpart') != subpart:
                        continue
                    evaluation_id = item.get('evaluation_id')
                    table.update_item(
                        Key={'evaluation_id': evaluation_id},
                        UpdateExpression=(
                            "SET question = :q, question_is_latex = :il, "
                            "question_reviewed_by = :rb, question_reviewed_at = :ra, updated_at = :ua"
                        ),
                        ExpressionAttributeValues={
                            ':q': corrected_question,
                            ':il': is_latex,
                            ':rb': caller['user_id'],
                            ':ra': now,
                            ':ua': now,
                        },
                        ConditionExpression=Attr('question_number').eq(question_number),
                    )
                    records_updated += 1
            except ClientError as e:
                errors.append(f"Database error updating student {student_id}, question {question_number}: {e.response['Error']['Message']}")
            except Exception as e:
                errors.append(f"Failed to update student {student_id}, question {question_number}: {str(e)}")

        updated_questions.append({
            'question_number': question_number,
            'subpart': subpart,
            'records_updated': records_updated,
        })

    response_data = {
        'message': 'Question correction completed' if not errors else 'Question correction completed with some errors',
        'updated_questions': updated_questions,
        'total_records_updated': sum(q['records_updated'] for q in updated_questions),
        'success': len(errors) == 0,
    }
    if errors:
        response_data['errors'] = errors

    if response_data['total_records_updated'] == 0:
        response_data['message'] = 'No question records were updated'
        return create_response(404, response_data)

    status_code = 200 if not errors else 207
    return create_response(status_code, response_data)
