"""
Email Service — sends question bank share notifications via SMTP.

Works with:
  - Brevo (Brevo/Bravo) for web/Render deployment
  - Any SMTP provider for local/mobile server
"""

import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional

from ..config import settings

import logging
logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASS and settings.FROM_EMAIL)


def send_share_notification(
    recipients: List[str],
    bank_title: str,
    subject_name: str,
    subject_code: str,
    sender_name: str,
    drive_link: Optional[str],
    excel_path: Optional[str],
) -> dict:
    """
    Send a question bank share notification email.

    Returns a dict:
        { "sent": [...], "failed": [...], "skipped": bool }
    """
    if not _smtp_configured():
        logger.warning("[EmailService] SMTP not configured — skipping email notifications.")
        return {"sent": [], "failed": recipients, "skipped": True}

    sent, failed = [], []

    html_body = _build_html_email(
        bank_title=bank_title,
        subject_name=subject_name,
        subject_code=subject_code,
        sender_name=sender_name,
        drive_link=drive_link,
    )

    for recipient in recipients:
        try:
            msg = MIMEMultipart("mixed")
            msg["From"]    = f"{settings.FROM_NAME} <{settings.FROM_EMAIL}>"
            msg["To"]      = recipient
            msg["Subject"] = f"📚 Question Bank Shared — {subject_code}: {bank_title}"

            # HTML body
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(html_body, "html", "utf-8"))
            msg.attach(alt)

            # Attach the Excel file if available
            if excel_path and os.path.exists(excel_path):
                with open(excel_path, "rb") as f:
                    part = MIMEBase("application",
                                    "vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=os.path.basename(excel_path),
                )
                msg.attach(part)

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.FROM_EMAIL, recipient, msg.as_string())

            sent.append(recipient)
            logger.info(f"[EmailService] Sent share notification to {recipient}")

        except Exception as e:
            logger.error(f"[EmailService] Failed to send to {recipient}: {e}")
            failed.append(recipient)

    return {"sent": sent, "failed": failed, "skipped": False}


def _build_html_email(
    bank_title: str,
    subject_name: str,
    subject_code: str,
    sender_name: str,
    drive_link: Optional[str],
) -> str:
    drive_section = ""
    if drive_link:
        drive_section = f"""
        <div style="margin:24px 0;text-align:center;">
            <a href="{drive_link}"
               style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ec4899,#8b5cf6);
                      color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                🔗 Open in Google Drive
            </a>
        </div>
        """

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
                 style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

            <!-- Header gradient -->
            <tr><td style="background:linear-gradient(135deg,#ec4899,#8b5cf6);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                📚 Question Bank Shared With You
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,.85);font-size:14px;">
                {subject_code} — {subject_name}
              </p>
            </td></tr>

            <!-- Body -->
            <tr><td style="padding:32px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Hello 👋,
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                <strong style="color:#ec4899;">{sender_name}</strong> has shared a question bank with you:
              </p>

              <!-- Bank details card -->
              <div style="background:#fdf2f8;border:1.5px solid #f9a8d4;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <p style="margin:0 0 8px;font-size:13px;color:#9d174d;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">
                  Question Bank
                </p>
                <h2 style="margin:0;font-size:20px;color:#1f2937;font-weight:700;">{bank_title}</h2>
                <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">Subject: {subject_code} — {subject_name}</p>
              </div>

              {drive_section}

              <p style="margin:24px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
                The question bank Excel file is also attached to this email for your convenience.
              </p>
            </td></tr>

            <!-- Footer -->
            <tr><td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This email was sent by <strong>Question Mind</strong> — AI-Powered Question Bank Generator
              </p>
            </td></tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """
