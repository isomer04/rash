"""DynamoDB client helpers for the Rash application data store."""

from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass


DEFAULT_TABLE_NAMES = {
    "users": "rash-users",
    "instruments": "rash-instruments",
    "accounts": "rash-accounts",
    "positions": "rash-positions",
    "jobs": "rash-jobs",
}

TABLE_ENV_VARS = {
    "users": "DYNAMODB_USERS_TABLE",
    "instruments": "DYNAMODB_INSTRUMENTS_TABLE",
    "accounts": "DYNAMODB_ACCOUNTS_TABLE",
    "positions": "DYNAMODB_POSITIONS_TABLE",
    "jobs": "DYNAMODB_JOBS_TABLE",
}

TABLE_KEYS = {
    "users": "clerk_user_id",
    "instruments": "symbol",
    "accounts": "id",
    "positions": "id",
    "jobs": "id",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_dynamodb(value: Any) -> Any:
    """Convert Python/Pydantic values to types accepted by boto3 DynamoDB."""
    if value is None or isinstance(value, (str, bool, Decimal)):
        return value
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): to_dynamodb(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_dynamodb(item) for item in value]
    if hasattr(value, "model_dump"):
        return to_dynamodb(value.model_dump())
    return str(value)


def from_dynamodb(value: Any) -> Any:
    """Convert DynamoDB Decimal values into JSON-friendly Python values."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {key: from_dynamodb(item) for key, item in value.items()}
    if isinstance(value, list):
        return [from_dynamodb(item) for item in value]
    return value


class DynamoDBClient:
    """Small wrapper around the DynamoDB resource API used by the model layer."""

    def __init__(
        self,
        region: Optional[str] = None,
        resource: Any = None,
        table_names: Optional[Dict[str, str]] = None,
        **_: Any,
    ) -> None:
        self.region = (
            region
            or os.getenv("DEFAULT_AWS_REGION")
            or os.getenv("AWS_REGION")
            or os.getenv("AWS_DEFAULT_REGION")
            or "us-east-1"
        )
        prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "rash")
        defaults = {key: f"{prefix}-{key}" for key in DEFAULT_TABLE_NAMES}
        self.table_names = {
            key: os.getenv(TABLE_ENV_VARS[key], defaults[key])
            for key in DEFAULT_TABLE_NAMES
        }
        if table_names:
            self.table_names.update(table_names)

        self.resource = resource or boto3.resource("dynamodb", region_name=self.region)
        self._tables: Dict[str, Any] = {}

    def table(self, logical_name: str) -> Any:
        if logical_name not in self.table_names:
            raise ValueError(f"Unknown DynamoDB table: {logical_name}")
        if logical_name not in self._tables:
            self._tables[logical_name] = self.resource.Table(self.table_names[logical_name])
        return self._tables[logical_name]

    def get(self, table: str, key: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        response = self.table(table).get_item(Key=to_dynamodb(key), ConsistentRead=True)
        item = response.get("Item")
        return from_dynamodb(item) if item else None

    def put(self, table: str, item: Dict[str, Any], condition: Any = None) -> None:
        kwargs: Dict[str, Any] = {"Item": to_dynamodb(item)}
        if condition is not None:
            kwargs["ConditionExpression"] = condition
        self.table(table).put_item(**kwargs)

    def insert(self, table: str, data: Dict[str, Any], returning: str = None) -> Optional[str]:
        item = dict(data)
        key_name = TABLE_KEYS[table]
        if key_name == "id" and not item.get("id"):
            item["id"] = str(uuid.uuid4())
        now = _utc_now()
        item.setdefault("created_at", now)
        item.setdefault("updated_at", now)
        # PutItem replaces a matching item by default. The SQL primary keys this
        # replaced rejected duplicates, so require the key to be absent instead
        # of silently overwriting an existing user or instrument.
        self.put(table, item, condition=Attr(key_name).not_exists())
        return str(item.get(returning)) if returning and item.get(returning) is not None else None

    def update(
        self,
        table: str,
        data: Dict[str, Any],
        where: str = "",
        where_params: Optional[Dict[str, Any]] = None,
    ) -> int:
        values = dict(data)
        values["updated_at"] = _utc_now()
        key_name = TABLE_KEYS[table]
        params = where_params or {}
        key_value = params.get(key_name)
        if key_value is None:
            raise ValueError(f"Update for {table} requires {key_name}")

        values.pop(key_name, None)
        if not values:
            return 0

        names = {f"#field{i}": name for i, name in enumerate(values)}
        expression_values = {
            f":value{i}": to_dynamodb(value) for i, value in enumerate(values.values())
        }
        set_expression = ", ".join(
            f"#field{i} = :value{i}" for i in range(len(values))
        )
        names["#key"] = key_name
        try:
            self.table(table).update_item(
                Key={key_name: to_dynamodb(key_value)},
                UpdateExpression=f"SET {set_expression}",
                # UpdateItem creates a missing item by default. The SQL schema this
                # replaced updated zero rows instead, so require the item to exist.
                ConditionExpression="attribute_exists(#key)",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=expression_values,
                ReturnValues="NONE",
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return 0
            raise
        return 1

    def delete(
        self,
        table: str,
        where: str = "",
        where_params: Optional[Dict[str, Any]] = None,
    ) -> int:
        key_name = TABLE_KEYS[table]
        params = where_params or {}
        key_value = params.get(key_name)
        if key_value is None:
            raise ValueError(f"Delete for {table} requires {key_name}")
        try:
            self.table(table).delete_item(
                Key={key_name: to_dynamodb(key_value)},
                # DeleteItem succeeds on a missing item. The SQL statement this
                # replaced deleted zero rows, so require the item to exist.
                ConditionExpression="attribute_exists(#key)",
                ExpressionAttributeNames={"#key": key_name},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return 0
            raise
        return 1

    def scan(self, table: str, *, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        response = self.table(table).scan()
        items.extend(response.get("Items", []))
        while response.get("LastEvaluatedKey") and (limit is None or len(items) < limit):
            response = self.table(table).scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            items.extend(response.get("Items", []))
        if limit is not None:
            items = items[:limit]
        return from_dynamodb(items)

    def query_index(
        self,
        table: str,
        index_name: str,
        partition_key: str,
        partition_value: Any,
        *,
        sort_key: Optional[str] = None,
        sort_value: Any = None,
        scan_forward: bool = True,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        condition = Key(partition_key).eq(to_dynamodb(partition_value))
        if sort_key is not None:
            condition = condition & Key(sort_key).eq(to_dynamodb(sort_value))
        kwargs = {
            "IndexName": index_name,
            "KeyConditionExpression": condition,
            "ScanIndexForward": scan_forward,
        }
        response = self.table(table).query(**kwargs)
        items.extend(response.get("Items", []))
        while response.get("LastEvaluatedKey") and (limit is None or len(items) < limit):
            response = self.table(table).query(
                **kwargs, ExclusiveStartKey=response["LastEvaluatedKey"]
            )
            items.extend(response.get("Items", []))
        if limit is not None:
            items = items[:limit]
        return from_dynamodb(items)

    def delete_items(self, table: str, items: Iterable[Dict[str, Any]]) -> int:
        key_name = TABLE_KEYS[table]
        count = 0
        with self.table(table).batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={key_name: to_dynamodb(item[key_name])})
                count += 1
        return count

