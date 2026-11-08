"""In-memory teacher class-record CSV, independent of anonymized research exports."""

import csv
import io

from app.gradebook.contracts import SectionGradebook


def csv_text(value: str) -> str:
    stripped = value.lstrip(" \t\r\n")
    dangerous = stripped.startswith(("=", "+", "-", "@")) or value[:1] in ("\t", "\r", "\n")
    return "'" + value if dangerous else value


def render_gradebook_csv(book: SectionGradebook) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([
        "student_name", "student_id", "activity_title", "activity_id", "points_possible",
        "final_points", "coursework_status", "publication", "included", "overall_percentage",
    ])
    activities = {item.id: item for item in book.activities}
    for row in book.rows:
        for cell in row.cells:
            writer.writerow([
                csv_text(row.student_name), str(row.student_id),
                csv_text(activities[cell.activity_id].title), str(cell.activity_id),
                format(cell.points_possible, ".2f") if cell.points_possible is not None else "",
                format(cell.final_points, ".2f") if cell.final_points is not None else "",
                cell.coursework_status, cell.publication, str(cell.included).lower(),
                format(row.totals.percentage, ".2f") if row.totals.percentage is not None else "",
            ])
    return output.getvalue().encode("utf-8-sig")
