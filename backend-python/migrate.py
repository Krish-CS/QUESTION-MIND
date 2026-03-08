from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE subjects ADD COLUMN nature VARCHAR(20) DEFAULT "THEORY"'))
        conn.commit()
        print("Column 'nature' added to subjects table")
    except Exception as e:
        if "Duplicate column" in str(e) or "already exists" in str(e).lower():
            print("Column 'nature' already exists")
        else:
            print(f"Error: {e}")

    try:
        conn.execute(text("ALTER TABLE question_patterns ADD COLUMN unit_question_counts JSON"))
        conn.commit()
        print("Column 'unit_question_counts' added to question_patterns table")
    except Exception as e:
        if "Duplicate column" in str(e) or "already exists" in str(e).lower():
            print("Column 'unit_question_counts' already exists")
        else:
            print(f"Error adding unit_question_counts: {e}")

    try:
        conn.execute(text("ALTER TABLE question_patterns ADD COLUMN unit_configs JSON"))
        conn.commit()
        print("Column 'unit_configs' added to question_patterns table")
    except Exception as e:
        if "Duplicate column" in str(e) or "already exists" in str(e).lower():
            print("Column 'unit_configs' already exists")
        else:
            print(f"Error adding unit_configs: {e}")
