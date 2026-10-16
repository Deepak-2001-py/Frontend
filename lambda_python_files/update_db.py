import json
import os
import boto3
import jwt
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
import datetime
from botocore.exceptions import ClientError

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
# SECURITY: this endpoint used to accept marks updates from anyone, with
# no check that the caller was even logged in, let alone that they were
# the teacher who owns the assignment being graded — a student could
# call this endpoint directly (bypassing the UI entirely) and rewrite
# anyone's marks. Every write now requires a valid
# Authorization: Bearer <token> (issued by lambda_python_files/
# authetication.py's generate_token()) and the caller's role (looked up
# fresh from the Users table, not trusted from the token) must be
# "teacher" or "admin" — a student token is always rejected here.
#
# JWT_SECRET must match the auth Lambda's JWT_SECRET env var exactly —
# these are separate Lambda deployments that have to agree on how
# tokens are signed. This function also needs API Gateway configured
# with Lambda **proxy** integration, since a custom/non-proxy mapping
# template that only forwards the JSON body drops the Authorization
# header before it reaches this function, and every request would then
# fail with 401.
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

def lambda_handler(event, context):
    """
    Lambda handler to handle student grade operations
    
    Parameters:
    - event: Contains query parameters and operation type
    - context: Lambda context
    """
    if event.get('httpMethod') == 'OPTIONS':
        return create_response(200, {'message': 'CORS preflight successful'})

    try:
        print(f"Received event: {json.dumps(event, indent=2)}")
        print(event)

        # Handle different HTTP methods and event structures
        if 'body' in event and event['body']:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event

        caller = authenticate(event)

        operation = body.get('operation')

        if operation == 'updateMarks':
            return update_student_marks_direct(body, caller)
        elif operation == 'updateStudentGrade':
            return update_student_grade_direct(body, caller)
        else:
            return create_response(400, {'error': 'Invalid operation specified'})

    except AuthError as e:
        return create_response(e.status_code, {'error': e.message})
    except json.JSONDecodeError as e:
        return create_response(400, {'error': f'Invalid JSON format: {str(e)}'})
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return create_response(500, {'error': f'Internal server error: {str(e)}'})

def create_response(status_code, body):
    """Create a standardized API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

def update_student_marks_direct(event, caller):
    """
    Direct update function using evaluation_ids from the request body
    - Updates summary records by finding records with type='summary' and matching evaluation_id
    - Updates detail records by finding records with matching evaluation_id, question_number, and subpart
    - Handles both single summary object and array formats

    Teacher/admin only. Every record touched here gets stamped with
    teacher_id = caller['user_id'], so future requests (here and in
    lambda_python_files/get_grades.py) can tell whose class this is —
    see the module docstring above for why this is a forward-looking
    fix rather than an instant guarantee across pre-existing rows.
    """
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': 'Only a teacher or admin can update grades.'})

    try:
        # Extract summary and details from the body
        summary_raw = event.get('summary')
        details_data = event.get('details', [])
        
        # # Handle both single object and array formats for summary
        # summary_data = []
        # if summary_raw:
        #     if isinstance(summary_raw, list):
        #         summary_data = summary_raw
        #     elif isinstance(summary_raw, dict):
        #         summary_data = [summary_raw]  # Convert single object to array
        
        if not summary_raw and not details_data:
            return create_response(400, {
                'error': 'Either summary or details data is required'
            })
        
        updated_items = []
        errors = []
        
        # Update summary records - find by type='summary' and evaluation_id from summary data
        # for summary_record in summary_data:
        try:
            summary_raw=summary_raw[0]
            print(f"summary_raw:{summary_raw}")
            evaluation_id = summary_raw.get('evaluation_id')
            print(f"summary evaluation_id:{evaluation_id}")
            total_marks = summary_raw.get('total_marks')
            print(f"summary total_marks:{total_marks}")
            
            # if not evaluation_id:
            #     errors.append("Missing evaluation_id in summary record")
            #     continue
            
            # if total_marks is None:
            #     errors.append(f"Missing total_marks for evaluation_id {evaluation_id}")
            #     continue
            
            # Convert total_marks to Decimal for DynamoDB
            total_marks_decimal = Decimal(str(total_marks))

            # A record that already names a different owning teacher can
            # only be touched by that teacher (or an admin) — stops one
            # teacher from overwriting another teacher's class by simply
            # sending an evaluation_id that isn't theirs.
            existing = table.get_item(Key={'evaluation_id': evaluation_id}).get('Item')
            existing_owner = existing.get('teacher_id') if existing else None
            if existing_owner and caller['role'] != 'admin' and existing_owner != caller['user_id']:
                errors.append(f"evaluation_id {evaluation_id} belongs to a different teacher.")
            else:
                # Update summary record where type='summary' and evaluation_id matches
                update_response = table.update_item(
                    Key={'evaluation_id': evaluation_id},
                    UpdateExpression="SET total_marks = :tm, updated_at = :ua, teacher_id = :tid",
                    ExpressionAttributeValues={
                        ':tm': total_marks_decimal,
                        ':ua': datetime.datetime.utcnow().isoformat(),
                        ':tid': caller['user_id']
                    },
                    ConditionExpression=Attr('type').eq('summary'),
                    ReturnValues="UPDATED_NEW"
                )

                updated_items.append({
                    'type': 'summary',
                    'evaluation_id': evaluation_id,
                    'updated': True,
                    'total_marks': float(total_marks_decimal),
                    'student_id': summary_raw.get('student_id'),
                    'assignment_id': summary_raw.get('assignment_id'),
                    'qp_id': summary_raw.get('qp_id')
                })
                print(f"Updated summary for evaluation_id {evaluation_id}")

        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                errors.append(f"No summary record found with evaluation_id {evaluation_id}")
            else:
                errors.append(f"Database error for evaluation_id {evaluation_id}: {e.response['Error']['Message']}")
        except ValueError as e:
            errors.append(f"Invalid total_marks value for evaluation_id {summary_raw.get('evaluation_id')}: {str(e)}")
        except Exception as e:
            errors.append(f"Failed to update summary for evaluation_id {summary_raw.get('evaluation_id')}: {str(e)}")
    
        # Update detail records - find by evaluation_id, question_number, and subpart
        for detail_record in details_data:
            try:
                evaluation_id = detail_record.get('evaluation_id')
                print(f"detail question evaluation_id:{evaluation_id}")
                question_number = detail_record.get('question_number')
                subpart = detail_record.get('subpart')
                marks = detail_record.get('marks')
                max_marks = detail_record.get('max_marks')  # Added max_marks handling
                print(f"question_number:{question_number} subpart:{subpart} marks: {marks} max_marks:{max_marks}")
                
                if not evaluation_id:
                    errors.append("Missing evaluation_id in detail record")
                    continue
                
                if question_number is None:
                    errors.append(f"Missing question_number for evaluation_id {evaluation_id}")
                    continue
                
                if marks is None:
                    errors.append(f"Missing marks for evaluation_id {evaluation_id}")
                    continue
                
                # Convert marks to Decimal for DynamoDB
                marks_decimal = Decimal(str(marks))

                # Same owning-teacher check as the summary update above.
                existing_detail = table.get_item(Key={'evaluation_id': evaluation_id}).get('Item')
                existing_detail_owner = existing_detail.get('teacher_id') if existing_detail else None
                if existing_detail_owner and caller['role'] != 'admin' and existing_detail_owner != caller['user_id']:
                    errors.append(f"evaluation_id {evaluation_id} belongs to a different teacher.")
                    continue

                # Build update expression
                update_expression = "SET marks = :m, updated_at = :ua, teacher_id = :tid"
                expression_values = {
                    ':m': marks_decimal,
                    ':ua': datetime.datetime.utcnow().isoformat(),
                    ':tid': caller['user_id']
                }

                # # Add max_marks to update if provided
                if max_marks is not None:
                    update_expression += ", max_marks = :mm"
                    expression_values[':mm'] = Decimal(str(max_marks))

                # Build condition expression for question_number and subpart matching
                condition_expr = Attr('question_number').eq(str(question_number))
                # if subpart:
                #     condition_expr = condition_expr & Attr('subpart').eq(subpart)
                # else:
                #     # Handle cases where subpart might be null/empty
                #     condition_expr = condition_expr & (Attr('subpart').not_exists() | Attr('subpart').eq('') | Attr('subpart').eq(None))

                # Update detail record with matching evaluation_id, question_number, and subpart
                update_response = table.update_item(
                    Key={'evaluation_id': evaluation_id},
                    # UpdateExpression="SET marks = :m, updated_at = :ua",
                UpdateExpression=update_expression,
                # ExpressionAttributeValues={
                #     ':m': marks_decimal,
                #     ':ua': datetime.datetime.utcnow().isoformat()
                # },
                ExpressionAttributeValues=expression_values,
                ConditionExpression=Attr('question_number').eq(question_number),
                # ConditionExpression= condition_expr,
                    ReturnValues="UPDATED_NEW"
                )

                updated_detail = {
                    'type': 'details',
                    'evaluation_id': evaluation_id,
                    'updated': True,
                    'marks': float(marks_decimal),
                    'question_number': str(question_number),
                    'subpart': subpart
                }

                if max_marks is not None:
                    updated_detail['max_marks'] = float(max_marks)

                updated_items.append(updated_detail)

            except ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    errors.append(f"No detail record found with evaluation_id {evaluation_id}, question_number {question_number}, subpart {subpart}")
                else:
                    errors.append(f"Database error for evaluation_id {evaluation_id}: {e.response['Error']['Message']}")
            except ValueError as e:
                errors.append(f"Invalid marks value for evaluation_id {detail_record.get('evaluation_id')}: {str(e)}")
            except Exception as e:
                errors.append(f"Failed to update details for evaluation_id {detail_record.get('evaluation_id')}: {str(e)}")
        
        # Prepare response
        response_data = {
            'message': 'Update completed',
            'updated_items': updated_items,
            'total_updated': len(updated_items),
            'success': len(errors) == 0,
            'records_processed': {
                'summary': len([summary_raw]),
                'details': len(details_data)
            }
        }
        
        if errors:
            response_data['errors'] = errors
            response_data['message'] = 'Update completed with some errors'
        
        if len(updated_items) == 0:
            response_data['message'] = 'No records were updated'
            return create_response(404, response_data)
        
        status_code = 200 if len(errors) == 0 else 207  # 207 for partial success
        return create_response(status_code, response_data)
        
    except Exception as e:
        print(f"Error in update_student_marks_direct: {str(e)}")
        return create_response(500, {'error': str(e)})

def update_student_grade_direct(event, caller):
    """
    Direct function to update only the Total Marks using provided evaluation_id
    Updates only records where type='summary'. Teacher/admin only.
    """
    if caller['role'] not in ('teacher', 'admin'):
        return create_response(403, {'error': 'Only a teacher or admin can update grades.'})

    try:
        evaluation_id = event.get('evaluation_id')
        total_marks = event.get('total_marks')

        if not evaluation_id:
            return create_response(400, {
                'error': 'evaluation_id is required'
            })

        if total_marks is None:
            return create_response(400, {
                'error': 'total_marks is required'
            })

        # Same owning-teacher check as update_student_marks_direct().
        existing = table.get_item(Key={'evaluation_id': evaluation_id}).get('Item')
        existing_owner = existing.get('teacher_id') if existing else None
        if existing_owner and caller['role'] != 'admin' and existing_owner != caller['user_id']:
            return create_response(403, {'error': 'This assignment belongs to a different teacher.'})

        # Convert total_marks to Decimal
        total_marks_decimal = Decimal(str(total_marks))

        # Direct update operation using the evaluation_id with condition for type='summary'
        update_response = table.update_item(
            Key={'evaluation_id': evaluation_id},
            UpdateExpression="SET total_marks = :tm, updated_at = :ua, teacher_id = :tid",
            ExpressionAttributeValues={
                ':tm': total_marks_decimal,
                ':ua': datetime.datetime.utcnow().isoformat(),
                ':tid': caller['user_id']
            },
            ConditionExpression=Attr('type').eq('summary'),
            ReturnValues="ALL_NEW"
        )

        print(f"Update response: {update_response}")
        
        return create_response(200, {
            'message': 'Total marks updated successfully',
            'evaluation_id': evaluation_id,
            'updated_attributes': convert_decimal(update_response.get('Attributes', {})),
            'total_marks': float(total_marks_decimal)
        })
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return create_response(404, {'error': f"No summary record found with evaluation_id {evaluation_id}"})
        else:
            print(f"DynamoDB error in update_student_grade_direct: {e.response['Error']['Message']}")
            return create_response(500, {'error': f"Database error: {e.response['Error']['Message']}"})
    except ValueError as e:
        return create_response(400, {'error': f'Invalid number format: {str(e)}'})
    except Exception as e:
        print(f"Error in update_student_grade_direct: {str(e)}")
        return create_response(500, {'error': str(e)})

# Batch update function for better performance when updating multiple records
#
# NOTE: not currently wired into lambda_handler's operation dispatch (no
# "operation" value below routes here), so it's dead code today. If this
# ever gets exposed, it needs the same role check + teacher_id
# stamping/ownership check added to update_student_marks_direct() above
# — it currently has none.
def batch_update_grades(event):
    """
    Batch update function for processing multiple records efficiently
    - Updates summary records with type='summary' condition
    - Updates detail records with question_number and subpart matching
    - Handles both single summary object and array formats
    """
    try:
        summary_raw = event.get('summary')
        details_data = event.get('details', [])
        
        # Handle both single object and array formats for summary
        summary_data = []
        if summary_raw:
            if isinstance(summary_raw, list):
                summary_data = summary_raw
            elif isinstance(summary_raw, dict):
                summary_data = [summary_raw]
        
        if not summary_data and not details_data:
            return create_response(400, {
                'error': 'Either summary or details data is required'
            })
        
        updated_items = []
        errors = []
        
        # Process summary updates in batches
        if summary_data:
            batch_results = process_summary_batch(summary_data)
            updated_items.extend(batch_results['updated'])
            errors.extend(batch_results['errors'])
        
        # Process details updates in batches
        if details_data:
            batch_results = process_details_batch(details_data)
            updated_items.extend(batch_results['updated'])
            errors.extend(batch_results['errors'])
        
        response_data = {
            'message': 'Batch update completed',
            'updated_items': updated_items,
            'total_updated': len(updated_items),
            'success': len(errors) == 0,
            'records_processed': {
                'summary': len(summary_data),
                'details': len(details_data)
            }
        }
        
        if errors:
            response_data['errors'] = errors
            response_data['message'] = 'Batch update completed with some errors'
        
        status_code = 200 if len(errors) == 0 else 207
        return create_response(status_code, response_data)
        
    except Exception as e:
        print(f"Error in batch_update_grades: {str(e)}")
        return create_response(500, {'error': str(e)})

def process_summary_batch(summary_data):
    """Process summary records in batch with type='summary' condition"""
    updated = []
    errors = []
    
    for record in summary_data:
        try:
            evaluation_id = record.get('evaluation_id')
            total_marks = record.get('total_marks')
            
            if not evaluation_id or total_marks is None:
                errors.append(f"Missing required fields for record: {record}")
                continue
            
            table.update_item(
                Key={'evaluation_id': evaluation_id},
                UpdateExpression="SET total_marks = :tm, updated_at = :ua",
                ExpressionAttributeValues={
                    ':tm': Decimal(str(total_marks)),
                    ':ua': datetime.datetime.utcnow().isoformat()
                },
                ConditionExpression=Attr('type').eq('summary')
            )
            
            updated.append({
                'type': 'summary',
                'evaluation_id': evaluation_id,
                'total_marks': float(total_marks)
            })
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                errors.append(f"No summary record found with evaluation_id {record.get('evaluation_id')}")
            else:
                errors.append(f"Failed to update summary {record.get('evaluation_id')}: {e.response['Error']['Message']}")
        except Exception as e:
            errors.append(f"Failed to update summary {record.get('evaluation_id')}: {str(e)}")
    
    return {'updated': updated, 'errors': errors}

def process_details_batch(details_data):
    """Process detail records in batch with question_number and subpart matching"""
    updated = []
    errors = []
    
    for record in details_data:
        try:
            evaluation_id = record.get('evaluation_id')
            marks = record.get('marks')
            question_number = record.get('question_number')
            subpart = record.get('subpart')
            max_marks = record.get('max_marks')
            
            if not evaluation_id or marks is None or question_number is None:
                errors.append(f"Missing required fields for record: {record}")
                continue
            
            # Build update expression
            update_expression = "SET marks = :m, updated_at = :ua"
            expression_values = {
                ':m': Decimal(str(marks)),
                ':ua': datetime.datetime.utcnow().isoformat()
            }
            
            # Add max_marks to update if provided
            if max_marks is not None:
                update_expression += ", max_marks = :mm"
                expression_values[':mm'] = Decimal(str(max_marks))
            
            # Build condition expression for question_number and subpart matching
            condition_expr = Attr('question_number').eq(str(question_number))
            if subpart:
                condition_expr = condition_expr & Attr('subpart').eq(subpart)
            else:
                # Handle cases where subpart might be null/empty
                condition_expr = condition_expr & (Attr('subpart').not_exists() | Attr('subpart').eq('') | Attr('subpart').eq(None))
            
            table.update_item(
                Key={'evaluation_id': evaluation_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_values,
                ConditionExpression=condition_expr
            )
            
            updated_detail = {
                'type': 'details',
                'evaluation_id': evaluation_id,
                'marks': float(marks),
                'question_number': str(question_number),
                'subpart': subpart
            }
            
            if max_marks is not None:
                updated_detail['max_marks'] = float(max_marks)
            
            updated.append(updated_detail)
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                errors.append(f"No detail record found with evaluation_id {record.get('evaluation_id')}, question_number {record.get('question_number')}, subpart {record.get('subpart')}")
            else:
                errors.append(f"Failed to update details {record.get('evaluation_id')}: {e.response['Error']['Message']}")
        except Exception as e:
            errors.append(f"Failed to update details {record.get('evaluation_id')}: {str(e)}")
    
    return {'updated': updated, 'errors': errors}