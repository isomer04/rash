#!/usr/bin/env python3
"""Offline smoke test for the DynamoDB-backed model contract."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from src import Database
from src.client import TABLE_KEYS, from_dynamodb, to_dynamodb
from src.schemas import InstrumentCreate


class FakeClient:
    def __init__(self):
        self.items = {name: {} for name in TABLE_KEYS}

    def get(self, table, key):
        value = self.items[table].get(str(key[TABLE_KEYS[table]]))
        return dict(value) if value else None

    def insert(self, table, data, returning=None):
        item = dict(data)
        key_name = TABLE_KEYS[table]
        if key_name == "id" and not item.get("id"):
            item["id"] = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        item.setdefault("created_at", now)
        item.setdefault("updated_at", now)
        if str(item[key_name]) in self.items[table]:
            raise ValueError(f"Duplicate key for {table}: {item[key_name]}")
        self.items[table][str(item[key_name])] = item
        return str(item[returning]) if returning else None

    def update(self, table, data, where="", where_params=None):
        del where
        key_name = TABLE_KEYS[table]
        key = str(where_params[key_name])
        if key not in self.items[table]:
            return 0
        self.items[table][key].update(data)
        return 1

    def delete(self, table, where="", where_params=None):
        del where
        key_name = TABLE_KEYS[table]
        removed = self.items[table].pop(str(where_params[key_name]), None)
        return 1 if removed else 0

    def scan(self, table, *, limit=None):
        items = [dict(item) for item in self.items[table].values()]
        return items if limit is None else items[:limit]

    def query_index(
        self,
        table,
        index_name,
        partition_key,
        partition_value,
        *,
        sort_key=None,
        sort_value=None,
        scan_forward=True,
        limit=None,
    ):
        del index_name
        items = [
            dict(item)
            for item in self.items[table].values()
            if item.get(partition_key) == partition_value
            and (sort_key is None or item.get(sort_key) == sort_value)
        ]
        index_sort_key = "symbol" if table == "positions" else "created_at"
        items = sorted(
            items, key=lambda item: item.get(index_sort_key, ""), reverse=not scan_forward
        )
        return items if limit is None else items[:limit]

    def delete_items(self, table, items):
        count = 0
        for item in list(items):
            self.items[table].pop(str(item[TABLE_KEYS[table]]), None)
            count += 1
        return count


def main() -> None:
    round_tripped = from_dynamodb(to_dynamodb({"value": 1.25}))
    assert round_tripped == {"value": 1.25}
    assert isinstance(round_tripped["value"], float)

    db = Database(client=FakeClient())
    user_id = db.users.create_user("user-1", "Test", 20, Decimal("60000"))
    assert user_id == "user-1"

    instrument = InstrumentCreate(
        symbol="SPY",
        name="SPDR S&P 500 ETF Trust",
        instrument_type="etf",
        current_price=Decimal("500.25"),
        allocation_regions={"north_america": 100},
        allocation_sectors={"diversified": 100},
        allocation_asset_class={"equity": 100},
    )
    db.instruments.create_instrument(instrument)

    account_id = db.accounts.create_account("user-1", "Brokerage")
    position_id = db.positions.add_position(account_id, "SPY", Decimal("2"))
    assert db.positions.find_by_id(position_id)["quantity"] == Decimal("2")
    assert db.positions.get_portfolio_value(account_id)["total_value"] == 1000.5

    same_position_id = db.positions.add_position(account_id, "SPY", Decimal("3"))
    assert same_position_id == position_id

    job_id = db.jobs.create_job("user-1", "portfolio_analysis", {"test": True})
    db.jobs.update_status(job_id, "running")
    db.jobs.update_report(job_id, {"markdown": "ok"})
    db.jobs.update_status(job_id, "completed")
    assert db.jobs.find_by_user("user-1")[0]["status"] == "completed"

    db.accounts.delete(account_id)
    assert db.positions.find_by_account(account_id) == []
    print("DynamoDB model smoke test passed.")


if __name__ == "__main__":
    main()
