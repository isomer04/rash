"""DynamoDB-backed domain models for Rash."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from .client import DynamoDBClient
from .schemas import InstrumentCreate


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BaseModel:
    table_name: str = ""
    key_name: str = "id"

    def __init__(self, db: DynamoDBClient):
        self.db = db
        if not self.table_name:
            raise ValueError("table_name must be defined")

    def find_by_id(self, item_id: Any) -> Optional[Dict[str, Any]]:
        return self.db.get(self.table_name, {self.key_name: str(item_id)})

    def find_all(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        items = self.db.scan(self.table_name)
        return items[offset : offset + limit]

    def create(self, data: Dict[str, Any], returning: str = "id") -> Optional[str]:
        return self.db.insert(self.table_name, data, returning=returning)

    def update(self, item_id: Any, data: Dict[str, Any]) -> int:
        return self.db.update(
            self.table_name,
            data,
            where_params={self.key_name: str(item_id)},
        )

    def delete(self, item_id: Any) -> int:
        return self.db.delete(
            self.table_name,
            where_params={self.key_name: str(item_id)},
        )


class Users(BaseModel):
    table_name = "users"
    key_name = "clerk_user_id"

    def find_by_clerk_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        return self.find_by_id(clerk_user_id)

    def create_user(
        self,
        clerk_user_id: str,
        display_name: str = None,
        years_until_retirement: int = None,
        target_retirement_income: Decimal = None,
    ) -> str:
        data = {
            "clerk_user_id": clerk_user_id,
            "display_name": display_name,
            "years_until_retirement": years_until_retirement,
            "target_retirement_income": target_retirement_income,
            "asset_class_targets": {"equity": 70, "fixed_income": 30},
            "region_targets": {"north_america": 50, "international": 50},
        }
        data = {key: value for key, value in data.items() if value is not None}
        return self.db.insert("users", data, returning="clerk_user_id")


class Instruments(BaseModel):
    table_name = "instruments"
    key_name = "symbol"

    def find_all(self, limit: int = None, offset: int = 0) -> List[Dict[str, Any]]:
        instruments = sorted(self.db.scan(self.table_name), key=lambda item: item["symbol"])
        return instruments[offset:] if limit is None else instruments[offset : offset + limit]

    def find_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        return self.find_by_id(symbol.upper())

    def create_instrument(self, instrument: InstrumentCreate) -> str:
        data = instrument.model_dump()
        data["symbol"] = data["symbol"].upper()
        return self.db.insert(self.table_name, data, returning="symbol")

    def find_by_type(self, instrument_type: str) -> List[Dict[str, Any]]:
        return [
            item for item in self.find_all() if item.get("instrument_type") == instrument_type
        ]

    def search(self, query: str) -> List[Dict[str, Any]]:
        needle = query.lower()
        return [
            item
            for item in self.find_all()
            if needle in item.get("symbol", "").lower()
            or needle in item.get("name", "").lower()
        ][:20]


class Accounts(BaseModel):
    table_name = "accounts"
    user_index = "clerk_user_id-created_at-index"

    def __init__(self, db: DynamoDBClient, positions: "Positions"):
        super().__init__(db)
        self.positions = positions

    def find_by_user(self, clerk_user_id: str) -> List[Dict[str, Any]]:
        return self.db.query_index(
            self.table_name,
            self.user_index,
            "clerk_user_id",
            clerk_user_id,
            scan_forward=False,
        )

    def create_account(
        self,
        clerk_user_id: str,
        account_name: str,
        account_purpose: str = None,
        cash_balance: Decimal = Decimal("0"),
        cash_interest: Decimal = Decimal("0"),
    ) -> str:
        return self.db.insert(
            self.table_name,
            {
                "clerk_user_id": clerk_user_id,
                "account_name": account_name,
                "account_purpose": account_purpose,
                "cash_balance": cash_balance,
                "cash_interest": cash_interest,
            },
            returning="id",
        )

    def delete(self, item_id: Any) -> int:
        # DynamoDB has no foreign keys, so the cascade is owned here. Delete the
        # account first: a failure then leaves the positions reachable instead of
        # orphaning them under an account that no longer exists.
        deleted = super().delete(item_id)
        if deleted:
            positions = self.positions.find_by_account(str(item_id))
            self.db.delete_items("positions", positions)
        return deleted


class Positions(BaseModel):
    table_name = "positions"
    account_index = "account_id-symbol-index"

    def __init__(self, db: DynamoDBClient, instruments: Instruments):
        super().__init__(db)
        self.instruments = instruments

    def find_by_account(self, account_id: str) -> List[Dict[str, Any]]:
        positions = self.db.query_index(
            self.table_name,
            self.account_index,
            "account_id",
            account_id,
        )
        for position in positions:
            instrument = self.instruments.find_by_symbol(position["symbol"])
            if instrument:
                position["instrument_name"] = instrument.get("name")
                position["instrument_type"] = instrument.get("instrument_type")
                position["current_price"] = instrument.get("current_price")
        return positions

    def get_portfolio_value(self, account_id: str) -> Dict[str, Any]:
        positions = self.find_by_account(account_id)
        total_value = sum(
            float(position.get("quantity", 0)) * float(position.get("current_price", 0) or 0)
            for position in positions
        )
        return {
            "num_positions": len(positions),
            "total_value": total_value,
            "total_shares": sum(float(position.get("quantity", 0)) for position in positions),
        }

    def add_position(self, account_id: str, symbol: str, quantity: Decimal) -> str:
        symbol = symbol.upper()
        # The account_id-symbol index is keyed on exactly this pair, so query it
        # directly rather than listing and enriching every position in the account.
        matches = self.db.query_index(
            self.table_name,
            self.account_index,
            "account_id",
            account_id,
            sort_key="symbol",
            sort_value=symbol,
            limit=1,
        )
        existing = matches[0] if matches else None
        if existing:
            self.update(
                existing["id"],
                {"quantity": quantity, "as_of_date": date.today().isoformat()},
            )
            return existing["id"]
        return self.db.insert(
            self.table_name,
            {
                "account_id": account_id,
                "symbol": symbol,
                "quantity": quantity,
                "as_of_date": date.today().isoformat(),
            },
            returning="id",
        )


class Jobs(BaseModel):
    table_name = "jobs"
    user_index = "clerk_user_id-created_at-index"

    def create_job(
        self,
        clerk_user_id: str,
        job_type: str,
        request_payload: Dict[str, Any] = None,
    ) -> str:
        return self.db.insert(
            self.table_name,
            {
                "clerk_user_id": clerk_user_id,
                "job_type": job_type,
                "status": "pending",
                "request_payload": request_payload,
            },
            returning="id",
        )

    def update_status(self, job_id: str, status: str, error_message: str = None) -> int:
        data: Dict[str, Any] = {"status": status}
        if status == "running":
            data["started_at"] = _utc_now()
        elif status in {"completed", "failed"}:
            data["completed_at"] = _utc_now()
        if error_message:
            data["error_message"] = error_message
        return self.update(job_id, data)

    def update_report(self, job_id: str, report_payload: Dict[str, Any]) -> int:
        return self.update(job_id, {"report_payload": report_payload})

    def update_charts(self, job_id: str, charts_payload: Dict[str, Any]) -> int:
        return self.update(job_id, {"charts_payload": charts_payload})

    def update_retirement(self, job_id: str, retirement_payload: Dict[str, Any]) -> int:
        return self.update(job_id, {"retirement_payload": retirement_payload})

    def update_summary(self, job_id: str, summary_payload: Dict[str, Any]) -> int:
        return self.update(job_id, {"summary_payload": summary_payload})

    def find_by_user(
        self,
        clerk_user_id: str,
        status: str = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        jobs = self.db.query_index(
            self.table_name,
            self.user_index,
            "clerk_user_id",
            clerk_user_id,
            scan_forward=False,
            # A status filter is applied after the query, so the limit can only be
            # pushed down when every returned job already qualifies.
            limit=None if status else limit,
        )
        if status:
            jobs = [job for job in jobs if job.get("status") == status]
        return jobs[:limit]


class Database:
    """Main database interface used by the API and all agents."""

    def __init__(
        self,
        cluster_arn: str = None,
        secret_arn: str = None,
        database: str = None,
        region: str = None,
        *,
        client: DynamoDBClient = None,
    ) -> None:
        del cluster_arn, secret_arn, database
        self.client = client or DynamoDBClient(region=region)
        self.users = Users(self.client)
        self.instruments = Instruments(self.client)
        self.positions = Positions(self.client, self.instruments)
        self.accounts = Accounts(self.client, self.positions)
        self.jobs = Jobs(self.client)

    def execute_raw(self, *_: Any, **__: Any) -> Dict[str, Any]:
        raise NotImplementedError("Raw SQL is not available with DynamoDB")

    def query_raw(self, *_: Any, **__: Any) -> List[Dict[str, Any]]:
        raise NotImplementedError("Raw SQL is not available with DynamoDB")
