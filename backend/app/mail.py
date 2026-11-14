"""Delivery for account links and opt-in practice reminders."""
import os
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit


def mail_ready():
    origin = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
    parsed = urlsplit(origin)
    safe_origin = (parsed.scheme == "https" or
                   (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}))
    return bool(safe_origin and parsed.hostname and not (parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password)
                and os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def app_url(path):
    return os.environ["PUBLIC_APP_URL"].rstrip("/") + path


def send_email(recipient, subject, body):
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)
    context = ssl.create_default_context()
    host = os.environ["SMTP_HOST"]
    implicit_tls = os.getenv("SMTP_IMPLICIT_TLS", "").lower() == "true"
    port = int(os.getenv("SMTP_PORT", "465" if implicit_tls else "587"))
    connection = (smtplib.SMTP_SSL(host, port, timeout=10, context=context)
                  if implicit_tls else smtplib.SMTP(host, port, timeout=10))
    with connection:
        if not implicit_tls:
            connection.starttls(context=context)
        if os.getenv("SMTP_USERNAME"):
            connection.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        connection.send_message(message)
