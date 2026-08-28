import { useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ConfirmModal from "../components/ConfirmModal";
import { API_URL } from "../lib/config";
import { SkeletonTable } from "../components/Skeleton";
import Head from "next/head";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Stat,
  StatGrid,
  Table,
  type Column,
} from "@/components/ui";
import {
  AlertIcon,
  CheckIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  WalletIcon,
} from "@/components/icons";

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

export default function Accounts() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [populatingData, setPopulatingData] = useState(false);
  const [resettingAccounts, setResettingAccounts] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', purpose: '', cash_balance: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'reset' | 'delete';
    accountId?: string;
    accountName?: string;
  }>({ isOpen: false, type: 'reset' });

  const loadAccounts = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Accounts received from API:', data);
        // For each account, load positions
        const accountsWithPositions = await Promise.all(
          data.map(async (account: Account) => {
            console.log('Processing account:', account.id, account.account_name);
            // Skip if account has no ID
            if (!account.id) {
              console.warn('Account missing ID:', account);
              return { ...account, positions: [] };
            }

            try {
              const positionsResponse = await fetch(
                `${API_URL}/api/accounts/${account.id}/positions`,
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );
              if (positionsResponse.ok) {
                const data = await positionsResponse.json();
                const positions = data.positions || [];
                console.log(`Loaded ${positions.length} positions for account ${account.id}`);
                return { ...account, positions };
              }
            } catch (err) {
              console.error(`Error loading positions for account ${account.id}:`, err);
            }
            return { ...account, positions: [] };
          })
        );
        console.log('Final accounts with positions:', accountsWithPositions);
        setAccounts(accountsWithPositions);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      setMessage({ type: 'error', text: 'Failed to load accounts' });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Listen for analysis completion events to refresh data
  useEffect(() => {
    const handleAnalysisCompleted = () => {
      // Refresh accounts to get updated prices after analysis
      console.log('Analysis completed - refreshing accounts...');
      loadAccounts();
    };

    // Listen for the completion event
    window.addEventListener('analysis:completed', handleAnalysisCompleted);

    return () => {
      window.removeEventListener('analysis:completed', handleAnalysisCompleted);
    };
  }, [loadAccounts]);

  const populateTestData = async () => {
    setPopulatingData(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/populate-test-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: data.message });
        await loadAccounts(); // Reload accounts after population
      } else {
        setMessage({ type: 'error', text: 'Failed to populate test data' });
      }
    } catch (error) {
      console.error('Error populating test data:', error);
      setMessage({ type: 'error', text: 'Error populating test data' });
    } finally {
      setPopulatingData(false);
    }
  };

  const resetAccounts = async () => {
    setResettingAccounts(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/reset-accounts`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: 'success', text: data.message });
        // Clear accounts immediately after successful reset
        setAccounts([]);
        // Then reload to confirm empty state
        await loadAccounts();
      } else {
        setMessage({ type: 'error', text: 'Failed to reset accounts' });
      }
    } catch (error) {
      console.error('Error resetting accounts:', error);
      setMessage({ type: 'error', text: 'Error resetting accounts' });
    } finally {
      setResettingAccounts(false);
    }
  };

  const calculateAccountTotal = (account: Account) => {
    const positionsValue = account.positions?.reduce((sum, position) => {
      const value = Number(position.quantity) * (Number(position.current_price) || 0);
      return sum + value;
    }, 0) || 0;
    return Number(account.cash_balance) + positionsValue;
  };

  const calculatePortfolioTotal = () => {
    return accounts.reduce((sum, account) => sum + calculateAccountTotal(account), 0);
  };

  const handleAddAccount = async () => {
    if (!newAccount.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter an account name' });
      return;
    }

    setSavingAccount(true);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/accounts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_name: newAccount.name,
          account_purpose: newAccount.purpose || 'Investment Account',
          cash_balance: parseFloat(newAccount.cash_balance.replace(/,/g, '')) || 0,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account created successfully' });
        setShowAddModal(false);
        setNewAccount({ name: '', purpose: '', cash_balance: '' });
        await loadAccounts();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'Failed to create account' });
      }
    } catch (error) {
      console.error('Error creating account:', error);
      setMessage({ type: 'error', text: 'Error creating account' });
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setDeletingAccountId(accountId);
    setMessage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Account deleted successfully' });
        await loadAccounts();
      } else {
        setMessage({ type: 'error', text: 'Failed to delete account' });
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      setMessage({ type: 'error', text: 'Error deleting account' });
    } finally {
      setDeletingAccountId(null);
    }
  };

  const formatCurrencyInput = (value: string) => {
    // Remove non-numeric characters except decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Format with commas
    const parts = cleaned.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const columns: Column<Account>[] = [
    {
      key: 'name',
      header: 'Account name',
      render: (account) => (
        <div>
          <p className="font-semibold text-text">{account.account_name}</p>
          <p className="text-xs text-text-muted md:hidden">{account.account_purpose}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (account) => <span className="text-sm text-text-secondary">{account.account_purpose}</span>,
    },
    {
      key: 'positions',
      header: 'Positions',
      numeric: true,
      render: (account) => {
        const positionsValue = calculateAccountTotal(account) - Number(account.cash_balance);
        return (
          <div>
            <p className="font-medium text-text">{account.positions?.length || 0}</p>
            {positionsValue > 0 && (
              <p className="text-xs text-text-muted">
                ${positionsValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'cash',
      header: 'Cash',
      numeric: true,
      render: (account) => `$${Number(account.cash_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      key: 'total',
      header: 'Total value',
      numeric: true,
      render: (account) => (
        <span className="font-semibold text-accent">
          ${calculateAccountTotal(account).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'center',
      render: (account) => (
        <div className="flex justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/accounts/${account.id}`)}
            aria-label={`View or edit ${account.account_name}`}
            iconLeft={<PencilIcon size={16} />}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmModal({
              isOpen: true,
              type: 'delete',
              accountId: account.id,
              accountName: account.account_name,
            })}
            disabled={deletingAccountId === account.id}
            aria-label={`Delete ${account.account_name}`}
            className="text-negative hover:bg-negative-soft"
            iconLeft={<TrashIcon size={16} />}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Accounts - Rash AI Financial Advisor</title>
      </Head>
      <Layout>
      <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="flex flex-col gap-4 border-b border-border pb-loose md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-2xs uppercase tracking-[0.08em] text-text-muted">Portfolio ledger</p>
              <CardTitle className="mt-1 text-2xl">Investment accounts</CardTitle>
              <p className="mt-1 text-sm text-text-secondary">Manage your investment accounts and portfolios</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowAddModal(true)} variant="primary" iconLeft={<PlusIcon size={16} />}>
                Add account
              </Button>
              {accounts.length === 0 && !loading && (
                <Button onClick={populateTestData} loading={populatingData} variant="secondary" iconLeft={<RefreshIcon size={16} />}>
                  Populate test data
                </Button>
              )}
              {accounts.length > 0 && (
                <Button onClick={() => setConfirmModal({ isOpen: true, type: 'reset' })} loading={resettingAccounts} variant="danger" iconLeft={<TrashIcon size={16} />}>
                  Reset all
                </Button>
              )}
            </div>
          </CardHeader>

          <CardBody className="space-y-section pt-loose">
            {message && (
              <div className={`flex items-start gap-3 border-l-2 p-4 text-sm ${message.type === 'success' ? 'border-positive bg-positive-soft text-positive' : 'border-negative bg-negative-soft text-negative'}`} role="status">
                {message.type === 'success' ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            {loading ? (
              <SkeletonTable rows={3} />
            ) : accounts.length === 0 ? (
              <EmptyState
                icon={<WalletIcon size={24} />}
                title="No accounts found"
                description="Populate test data to create sample accounts with positions, or add an account manually."
              />
            ) : (
              <>
                <StatGrid columns={3}>
                  <Stat label="Total portfolio value" value={`$${calculatePortfolioTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                  <Stat label="Number of accounts" value={accounts.length} />
                  <Stat label="Total positions" value={accounts.reduce((sum, acc) => sum + (acc.positions?.length || 0), 0)} />
                </StatGrid>
                <Table
                  columns={columns}
                  rows={accounts}
                  getRowKey={(account) => account.id}
                  caption="Investment accounts"
                  density="default"
                  zebra
                />
              </>
            )}
          </CardBody>
        </Card>

        {/* Add Account Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
            <Card className="w-full max-w-md shadow-overlay" padding="loose" role="dialog" aria-modal="true" aria-labelledby="add-account-title">
              <CardTitle id="add-account-title" className="text-xl">Add new account</CardTitle>

              <div className="space-y-4">
                <Input
                    label="Account name *"
                    type="text"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="e.g., 401k, Roth IRA, Brokerage"
                  />

                <Input
                    label="Account purpose"
                    type="text"
                    value={newAccount.purpose}
                    onChange={(e) => setNewAccount({ ...newAccount, purpose: e.target.value })}
                    placeholder="e.g., Long-term Growth, Retirement"
                  />

                <Input
                    label="Initial cash balance"
                    leadingIcon={<span aria-hidden="true">$</span>}
                    numeric
                      type="text"
                      value={newAccount.cash_balance}
                      onChange={(e) => setNewAccount({ ...newAccount, cash_balance: formatCurrencyInput(e.target.value) })}
                      placeholder="0.00"
                  />
              </div>

              {message && message.type === 'error' && (
                <div className="mt-4 border-l-2 border-negative bg-negative-soft p-3 text-sm text-negative">
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleAddAccount}
                  disabled={savingAccount}
                  className="flex-1"
                  loading={savingAccount}
                  variant="primary"
                >
                  Create account
                </Button>
                <Button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewAccount({ name: '', purpose: '', cash_balance: '' });
                    setMessage(null);
                  }}
                  className="flex-1"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.type === 'reset' ? 'Reset All Accounts' : 'Delete Account'}
          message={
            confirmModal.type === 'reset' ? (
              <div>
                <p className="font-semibold mb-2">Are you sure you want to delete all your accounts?</p>
                <p className="text-sm">This will permanently remove:</p>
                <ul className="list-disc list-inside text-sm mt-1 ml-2">
                  <li>All {accounts.length} account{accounts.length !== 1 ? 's' : ''}</li>
                  <li>All positions in those accounts</li>
                  <li>All transaction history</li>
                </ul>
                <p className="mt-3 text-sm font-semibold text-negative">This action cannot be undone.</p>
              </div>
            ) : (
              <div>
                <p>Are you sure you want to delete <span className="font-semibold">&ldquo;{confirmModal.accountName}&rdquo;</span>?</p>
                <p className="text-sm mt-2">This will also delete all positions in this account.</p>
                <p className="mt-2 text-sm font-semibold text-negative">This action cannot be undone.</p>
              </div>
            )
          }
          confirmText={confirmModal.type === 'reset' ? 'Delete All Accounts' : 'Delete Account'}
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmModal.type === 'reset') {
              resetAccounts();
            } else if (confirmModal.accountId) {
              handleDeleteAccount(confirmModal.accountId);
            }
            setConfirmModal({ isOpen: false, type: 'reset' });
          }}
          onCancel={() => setConfirmModal({ isOpen: false, type: 'reset' })}
          isProcessing={resettingAccounts || deletingAccountId !== null}
        />
      </div>
      </Layout>
    </>
  );
}
