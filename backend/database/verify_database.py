#!/usr/bin/env python3
"""Verify DynamoDB tables and application-level relationships."""

from src import Database


def main() -> int:
    db = Database()
    failures = []
    records = {table: db.client.scan(table) for table in db.client.table_names}

    for table, items in records.items():
        status = db.client.table(table).table_status
        print(f"{table}: {status}, {len(items)} records")
        if status != "ACTIVE":
            failures.append(f"{table} is {status}")

    user_ids = {item["clerk_user_id"] for item in records["users"]}
    account_ids = {item["id"] for item in records["accounts"]}
    symbols = {item["symbol"] for item in records["instruments"]}

    for account in records["accounts"]:
        if account.get("clerk_user_id") not in user_ids:
            failures.append(f"orphan account {account['id']}")
    for position in records["positions"]:
        if position.get("account_id") not in account_ids:
            failures.append(f"orphan position {position['id']}")
        if position.get("symbol") not in symbols:
            failures.append(f"position {position['id']} has unknown symbol")
    for job in records["jobs"]:
        if job.get("clerk_user_id") not in user_ids:
            failures.append(f"orphan job {job['id']}")

    if failures:
        print("Verification failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("DynamoDB verification complete: tables and relationships are valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
