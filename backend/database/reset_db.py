#!/usr/bin/env python3
"""Clear DynamoDB application tables, reload instruments, and add optional test data."""

import argparse
import subprocess
import sys
from decimal import Decimal

from src import Database


TABLES = ("positions", "accounts", "jobs", "instruments", "users")


def clear_tables(db: Database) -> None:
    print("Clearing DynamoDB tables...")
    for table in TABLES:
        items = db.client.scan(table)
        count = db.client.delete_items(table, items)
        print(f"  {table}: deleted {count}")


def create_test_data(db: Database) -> None:
    user_id = "test_user_001"
    if not db.users.find_by_clerk_id(user_id):
        db.users.create_user(
            user_id,
            display_name="Test User",
            years_until_retirement=25,
            target_retirement_income=Decimal("100000"),
        )

    existing = next(
        (
            account
            for account in db.accounts.find_by_user(user_id)
            if account.get("account_name") == "401(k)"
        ),
        None,
    )
    if existing:
        account_id = existing["id"]
    else:
        account_id = db.accounts.create_account(
            user_id,
            account_name="401(k)",
            account_purpose="Primary retirement savings",
            cash_balance=Decimal("5000"),
            cash_interest=Decimal("0.045"),
        )
    for symbol, quantity in (
        ("SPY", "100"),
        ("QQQ", "50"),
        ("BND", "200"),
        ("VEA", "150"),
        ("GLD", "25"),
    ):
        db.positions.add_position(account_id, symbol, Decimal(quantity))
    print(f"Created test user {user_id} with account {account_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset Rash DynamoDB data")
    parser.add_argument("--with-test-data", action="store_true")
    parser.add_argument("--skip-drop", action="store_true")
    args = parser.parse_args()

    db = Database()
    if not args.skip_drop:
        clear_tables(db)

    result = subprocess.run(
        ["uv", "run", "seed_data.py"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return result.returncode
    print("Instrument seed data loaded")

    if args.with_test_data:
        create_test_data(db)

    for table in reversed(TABLES):
        print(f"{table}: {len(db.client.scan(table))} records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
