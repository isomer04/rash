#!/usr/bin/env python3
"""Narrow DynamoDB connectivity test for Part 5."""

from src import Database


def main() -> int:
    db = Database()
    for logical_name, physical_name in db.client.table_names.items():
        status = db.client.table(logical_name).table_status
        print(f"{logical_name}: {physical_name} ({status})")
        if status != "ACTIVE":
            return 1
    print("Successfully connected to all Rash DynamoDB tables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
