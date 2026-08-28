import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import ConfirmModal from "../../components/ConfirmModal";
import { API_URL } from "../../lib/config";
import { SkeletonCard } from "../../components/Skeleton";
import {
  Button, Card, CardBody, CardHeader, CardTitle, EmptyState, Input,
  Stat, StatGrid, Table, type Column,
} from "@/components/ui";
import {
  AlertIcon, CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon, WalletIcon,
} from "@/components/icons";

interface Instrument {
  symbol: string;
  name: string;
  instrument_type: string;
  current_price: number;
}

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  current_price?: number;
}

interface Account {
  id: string;
  account_name: string;
  account_purpose: string;
  cash_balance: number;
  positions?: Position[];
}

export default function AccountDetail() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingAccount, setEditingAccount] = useState(false);
  const [editedAccount, setEditedAccount] = useState({ name: '', purpose: '', cash_balance: '' });
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [editedQuantity, setEditedQuantity] = useState('');
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPosition, setNewPosition] = useState({ symbol: '', quantity: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showSymbolSuggestions, setShowSymbolSuggestions] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    positionId: string;
    symbol: string;
  }>({ isOpen: false, positionId: '', symbol: '' });

  const loadAccount = useCallback(async () => {
    if (!id) return;

    try {
      const token = await getToken();

      // Load account details
      const accountResponse = await fetch(`${API_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (accountResponse.ok) {
        const accounts = await accountResponse.json();
        const foundAccount = accounts.find((acc: Account) => acc.id === id);

        if (foundAccount) {
          setAccount(foundAccount);
          setEditedAccount({
            name: foundAccount.account_name,
            purpose: foundAccount.account_purpose,
            cash_balance: Number(foundAccount.cash_balance).toLocaleString('en-US'),
          });
        } else {
          setMessage({ type: 'error', text: 'Account not found' });
          setTimeout(() => router.push('/accounts'), 2000);
          return;
        }
      }

      // Load positions
      const positionsResponse = await fetch(
        `${API_URL}/api/accounts/${id}/positions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (positionsResponse.ok) {
        const data = await positionsResponse.json();
        setPositions(data.positions || []);
      }

      // Load instruments for autocomplete
      const instrumentsResponse = await fetch(
        `${API_URL}/api/instruments`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (instrumentsResponse.ok) {
        const instrumentsData = await instrumentsResponse.json();
        setInstruments(instrumentsData);
      }

    } catch (error) {
      console.error('Error loading account:', error);
      setMessage({ type: 'error', text: 'Failed to load account details' });
    } finally {
      setLoading(false);
    }
  }, [id, getToken, router]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const handleSaveAccount = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_name: editedAccount.name,
          account_purpose: editedAccount.purpose,
          cash_balance: parseFloat(editedAccount.cash_balance.replace(/,/g, '')),
        }),
      });

      if (response.ok) {
        const updatedAccount = await response.json();
        setAccount(updatedAccount);
        setEditingAccount(false);
        setMessage({ type: 'success', text: 'Account updated successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update account' });
      }
    } catch (error) {
      console.error('Error updating account:', error);
      setMessage({ type: 'error', text: 'Error updating account' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePosition = async (positionId: string) => {
    const quantity = parseFloat(editedQuantity);
    if (isNaN(quantity) || quantity < 0) {
      setMessage({ type: 'error', text: 'Please enter a valid quantity' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/positions/${positionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: quantity,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Position updated successfully' });
        setEditingPosition(null);
        await loadAccount();
      } else {
        setMessage({ type: 'error', text: 'Failed to update position' });
      }
    } catch (error) {
      console.error('Error updating position:', error);
      setMessage({ type: 'error', text: 'Error updating position' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/positions/${positionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Position deleted successfully' });
        await loadAccount();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete position' });
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      setMessage({ type: 'error', text: 'Error deleting position' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPosition = async () => {
    if (!newPosition.symbol.trim() || !newPosition.quantity.trim()) {
      setMessage({ type: 'error', text: 'Please enter symbol and quantity' });
      return;
    }

    const quantity = parseFloat(newPosition.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid quantity' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/positions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: id,
          symbol: newPosition.symbol.toUpperCase(),
          quantity: quantity,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Position added successfully' });
        setShowAddPosition(false);
        setNewPosition({ symbol: '', quantity: '' });
        setSearchTerm('');
        await loadAccount();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to add position' });
      }
    } catch (error) {
      console.error('Error adding position:', error);
      setMessage({ type: 'error', text: 'Error adding position' });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrencyInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const calculatePositionsValue = () => {
    return positions.reduce((sum, position) => {
      return sum + (Number(position.quantity) * (position.current_price || 0));
    }, 0);
  };

  const calculateTotalValue = () => {
    return (account ? Number(account.cash_balance) : 0) + calculatePositionsValue();
  };

  const filteredInstruments = instruments.filter(inst =>
    inst.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const positionColumns: Column<Position>[] = [
    { key: 'symbol', header: 'Symbol', render: (position) => <span className="font-semibold text-text">{position.symbol}</span> },
    {
      key: 'quantity', header: 'Quantity', numeric: true,
      render: (position) => editingPosition === position.id ? (
        <Input label={`Quantity for ${position.symbol}`} labelHidden type="number" value={editedQuantity}
          onChange={(e) => setEditedQuantity(e.target.value)} className="w-24" step="0.01" min="0" numeric />
      ) : Number(position.quantity).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    },
    {
      key: 'price', header: 'Price', numeric: true,
      render: (position) => position.current_price == null
        ? 'N/A'
        : `$${position.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: 'value', header: 'Market value', numeric: true,
      render: (position) => <span className="font-semibold text-accent">${((position.current_price || 0) * Number(position.quantity)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
    },
    {
      key: 'actions', header: 'Actions', srOnlyHeader: true, align: 'center',
      render: (position) => (
        <div className="flex justify-center gap-1">
          {editingPosition === position.id ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleUpdatePosition(position.id)} disabled={saving}
                aria-label={`Save ${position.symbol} quantity`} className="text-positive hover:bg-positive-soft" iconLeft={<CheckIcon size={16} />} />
              <Button variant="ghost" size="sm" onClick={() => { setEditingPosition(null); setEditedQuantity(''); }}
                aria-label={`Cancel editing ${position.symbol}`} iconLeft={<CloseIcon size={16} />} />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => {
                setEditingPosition(position.id);
                const qty = Number(position.quantity);
                setEditedQuantity(qty % 1 === 0 ? qty.toString() : qty.toFixed(2));
              }} aria-label={`Edit ${position.symbol} quantity`} iconLeft={<PencilIcon size={16} />} />
              <Button variant="ghost" size="sm" onClick={() => setConfirmModal({ isOpen: true, positionId: position.id, symbol: position.symbol })}
                disabled={saving} aria-label={`Delete ${position.symbol}`} className="text-negative hover:bg-negative-soft" iconLeft={<TrashIcon size={16} />} />
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8" aria-busy="true">
          <SkeletonCard />
        </div>
      </Layout>
    );
  }

  if (!account) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8">
          <EmptyState icon={<AlertIcon size={24} />} title="Account not found" description="Return to your accounts ledger and choose another account." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-7xl space-y-section px-4 py-page sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Button
            onClick={() => router.push('/accounts')}
            variant="ghost"
            size="sm"
          >
            <span aria-hidden="true">←</span> Back to accounts
          </Button>
        </div>

        {/* Account Details */}
        <Card>
          <CardHeader className="flex items-start justify-between border-b border-border pb-loose">
            <div className="flex-1">
              {editingAccount ? (
                <div className="max-w-md space-y-4">
                    <Input label="Account name"
                      type="text"
                      value={editedAccount.name}
                      onChange={(e) => setEditedAccount({ ...editedAccount, name: e.target.value })}
                    />
                    <Input label="Account purpose"
                      type="text"
                      value={editedAccount.purpose}
                      onChange={(e) => setEditedAccount({ ...editedAccount, purpose: e.target.value })}
                    />
                    <Input label="Cash balance" leadingIcon={<span aria-hidden="true">$</span>} numeric
                        type="text"
                        value={editedAccount.cash_balance}
                        onChange={(e) => setEditedAccount({ ...editedAccount, cash_balance: formatCurrencyInput(e.target.value) })}
                      />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveAccount}
                      disabled={saving}
                      variant="primary" loading={saving}
                    >
                      Save changes
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingAccount(false);
                        setEditedAccount({
                          name: account.account_name,
                          purpose: account.account_purpose,
                          cash_balance: Number(account.cash_balance).toLocaleString('en-US'),
                        });
                      }}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-2xs uppercase tracking-[0.08em] text-text-muted">Account ledger</p>
                  <CardTitle className="mt-1 text-2xl">{account.account_name}</CardTitle>
                  <p className="mt-1 text-text-secondary">{account.account_purpose}</p>
                </>
              )}
            </div>
            {!editingAccount && (
              <Button
                onClick={() => setEditingAccount(true)}
                variant="ghost" size="sm" aria-label="Edit account" iconLeft={<PencilIcon size={16} />}
              />
            )}
          </CardHeader>

          <CardBody className="space-y-section pt-loose">

          {message && (
            <div className={`flex items-start gap-3 border-l-2 p-4 text-sm ${
              message.type === 'success'
                ? 'border-positive bg-positive-soft text-positive'
                : 'border-negative bg-negative-soft text-negative'
            }`} role="status">
              {message.type === 'success' ? <CheckIcon size={18} /> : <AlertIcon size={18} />}<span>{message.text}</span>
            </div>
          )}

          {/* Account Summary */}
          <StatGrid columns={4}>
            <Stat label="Cash balance" value={`$${Number(account.cash_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Stat label="Positions value" value={`$${calculatePositionsValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Stat label="Total value" value={`$${calculateTotalValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <Stat label="Positions" value={positions.length} />
          </StatGrid>
          </CardBody>
        </Card>

        {/* Positions */}
        <Card>
          <CardHeader className="flex items-center justify-between border-b border-border pb-loose">
            <CardTitle className="text-xl">Positions</CardTitle>
            <Button
              onClick={() => setShowAddPosition(true)}
              variant="primary" iconLeft={<PlusIcon size={16} />}
            >
              Add position
            </Button>
          </CardHeader>

          <CardBody className="pt-loose">
          {positions.length === 0 ? (
            <EmptyState icon={<WalletIcon size={24} />} title="No positions in this account yet" description="Add a position to start building this portfolio." />
          ) : (
            <Table columns={positionColumns} rows={positions} getRowKey={(position) => position.id} caption="Account positions" zebra />
          )}
          </CardBody>
        </Card>

        {/* Add Position Modal */}
        {showAddPosition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
            <Card className="w-full max-w-md shadow-overlay" role="dialog" aria-modal="true" aria-labelledby="add-position-title">
              <CardTitle id="add-position-title" className="text-xl">Add new position</CardTitle>

              <div className="space-y-4">
                <div>
                  <div className="relative">
                    <Input
                      id="position-symbol"
                      label="Symbol *"
                      type="text"
                      value={searchTerm || newPosition.symbol}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase();
                        setSearchTerm(value);
                        setNewPosition({ ...newPosition, symbol: value });
                        setShowSymbolSuggestions(value.length > 0);
                      }}
                      onFocus={() => setShowSymbolSuggestions(searchTerm.length > 0)}
                      className="uppercase"
                      placeholder="Enter ticker symbol (e.g., SPY, AAPL)"
                    />

                    {showSymbolSuggestions && filteredInstruments.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border-strong bg-surface-raised shadow-float">
                        {filteredInstruments.map((inst) => (
                          <Button
                            key={inst.symbol}
                            onClick={() => {
                              setNewPosition({ ...newPosition, symbol: inst.symbol });
                              setSearchTerm('');
                              setShowSymbolSuggestions(false);
                            }}
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-none border-b border-border px-3 py-2 text-left text-text last:border-b-0 hover:bg-surface-sunken"
                          >
                            <span>
                              <span className="block font-medium">{inst.symbol}</span>
                              <span className="block text-xs text-text-muted">{inst.name}</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    If the symbol is not in our database, it will be added automatically
                  </p>
                </div>

                <Input label="Quantity *" numeric
                    type="number"
                    value={newPosition.quantity}
                    onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                    placeholder="0"
                    step="0.01"
                    min="0"
                  />
              </div>

              {message && message.type === 'error' && (
                <div className="mt-4 border-l-2 border-negative bg-negative-soft p-3 text-sm text-negative">
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleAddPosition}
                  disabled={saving}
                  className="flex-1" variant="primary" loading={saving}
                >
                  Add position
                </Button>
                <Button
                  onClick={() => {
                    setShowAddPosition(false);
                    setNewPosition({ symbol: '', quantity: '' });
                    setSearchTerm('');
                    setShowSymbolSuggestions(false);
                    setMessage(null);
                  }}
                  className="flex-1" variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Delete Position Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title="Delete Position"
          message={
            <div>
              <p>Are you sure you want to delete your <span className="font-semibold">{confirmModal.symbol}</span> position?</p>
              <p className="mt-2 text-sm text-text-secondary">This will remove this holding from your account.</p>
              <p className="mt-2 text-sm font-semibold text-negative">This action cannot be undone.</p>
            </div>
          }
          confirmText="Delete Position"
          cancelText="Cancel"
          onConfirm={() => {
            handleDeletePosition(confirmModal.positionId);
            setConfirmModal({ isOpen: false, positionId: '', symbol: '' });
          }}
          onCancel={() => setConfirmModal({ isOpen: false, positionId: '', symbol: '' })}
          isProcessing={saving}
        />
      </div>
    </Layout>
  );
}
