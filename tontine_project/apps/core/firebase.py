import firebase_admin
from firebase_admin import credentials

cred = credentials.Certificate("e-dr-pharma-fcm-firebase-adminsdk-fbsvc-c58df96975.json")
firebase_admin.initialize_app(cred)