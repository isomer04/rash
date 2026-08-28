#!/usr/bin/env python3
"""Verify the DynamoDB tables created by Terraform.

DynamoDB has no SQL schema migration step. Terraform owns table and index shape.
"""

from src import Database


def main() -> int:
    db = Database()
    failed = []
    for logical_name, physical_name in db.client.table_names.items():
        try:
            status = db.client.table(logical_name).table_status
            print(f"{logical_name}: {physical_name} ({status})")
            if status != "ACTIVE":
                failed.append(logical_name)
        except Exception as exc:
            print(f"{logical_name}: ERROR {exc}")
            failed.append(logical_name)
    if failed:
        print(f"DynamoDB verification failed: {', '.join(failed)}")
        return 1
    print("All DynamoDB tables are active. No schema migration is required.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
