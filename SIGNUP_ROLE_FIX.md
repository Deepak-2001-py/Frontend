# Signup role vulnerability fix

Issue: `POST /auth/signup` stored any client-supplied `role`, so anyone could register as `admin`.

## Moves taken

1. **Reviewed `backend/src/services/auth.service.js`** — to find where `signup()` copies `body.role` into `userRole` unchecked.
2. **Reviewed `admin.service.js` and `middleware/auth.js`** — to confirm the stored `userRole` alone decides admin/teacher access, so the bug is exploitable.
3. **Added `SIGNUP_ROLES = ['student', 'teacher']` in `auth.service.js`** — to define the only roles public signup may create.
4. **Rejected other roles with a 400 in `signup()`** — so `admin` (or any made-up role) can no longer be self-assigned.
5. **Defaulted a missing role to `student`** — so an empty role can't create an account with no or ambiguous privileges.
6. **Added `SIGNUP_ROLES` and the same check in `lambda_python_files/authetication.py`** — because the original Lambda has the identical flaw and must behave like the Node backend.
7. **Returned `{'message': 'Role must be student or teacher.'}` with status 400 from the Lambda** — to match the Node error body and status.
8. **Updated the security note in `backend/README.md`** — it said self-signup could create admins, which is no longer true.
9. **Left the frontend `Signup.tsx` unchanged** — it only offers student and teacher, so it keeps working.
10. **Left `scripts/parity/cases.json` unchanged** — its signup cases only use `student` or no role, so parity results don't change.
11. **Did not run the tests** — I only edited the code; run `npm test` in `backend/` and the Python tests to confirm.

## Follow-up

- Create admin accounts only through an admin-only flow (the existing invite / first-login flow), never public signup.
