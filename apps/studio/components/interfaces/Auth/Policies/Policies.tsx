import type { PostgresPolicy, PostgresTable } from '@supabase/postgres-meta'
import { useParams } from 'common/hooks'
import { PolicyEditorModal, PolicyTableRow } from 'components/interfaces/Auth/Policies'
import { useStore } from 'hooks'
import { isEmpty } from 'lodash'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import { IconHelpCircle } from 'ui'

import { useQueryClient } from '@tanstack/react-query'
import { useIsRLSAIAssistantEnabled } from 'components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import { SYSTEM_ROLES } from 'components/interfaces/Database/Roles/Roles.constants'
import { useProjectContext } from 'components/layouts/ProjectLayout/ProjectContext'
import NoSearchResults from 'components/to-be-cleaned/NoSearchResults'
import ProductEmptyState from 'components/to-be-cleaned/ProductEmptyState'
import ConfirmModal from 'components/ui/Dialogs/ConfirmDialog'
import InformationBox from 'components/ui/InformationBox'
import { useDatabaseRolesQuery } from 'data/database-roles/database-roles-query'
import { tableKeys } from 'data/tables/keys'

interface PoliciesProps {
  tables: PostgresTable[]
  hasTables: boolean
  isLocked: boolean
  onSelectEditPolicy: (policy: PostgresPolicy) => void
}

const Policies = ({
  tables,
  hasTables,
  isLocked,
  onSelectEditPolicy: onSelectEditPolicyAI,
}: PoliciesProps) => {
  const router = useRouter()
  const { ref } = useParams()
  const { project } = useProjectContext()

  const { ui, meta } = useStore()
  const queryClient = useQueryClient()
  const isAiAssistantEnabled = useIsRLSAIAssistantEnabled()

  const { data } = useDatabaseRolesQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const roles = (data ?? []).filter((role) => SYSTEM_ROLES.includes(role.name))

  const [selectedSchemaAndTable, setSelectedSchemaAndTable] = useState<any>({})
  const [selectedTableToToggleRLS, setSelectedTableToToggleRLS] = useState<any>({})
  const [RLSEditorWithAIShown, showRLSEditorWithAI] = useState(false)
  const [selectedPolicyToEdit, setSelectedPolicyToEdit] = useState<PostgresPolicy | {}>({})
  const [selectedPolicyToDelete, setSelectedPolicyToDelete] = useState<any>({})

  const closePolicyEditorModal = useCallback(() => {
    setSelectedPolicyToEdit({})
    setSelectedSchemaAndTable({})
    if (RLSEditorWithAIShown) {
      showRLSEditorWithAI(false)
    }
  }, [RLSEditorWithAIShown])

  const closeConfirmModal = () => {
    setSelectedPolicyToDelete({})
    setSelectedTableToToggleRLS({})
  }

  const onSelectToggleRLS = (table: any) => {
    setSelectedTableToToggleRLS(table)
  }

  const onSelectCreatePolicy = (table: any) => {
    setSelectedSchemaAndTable({ schema: table.schema, table: table.name })
  }

  const onSelectEditPolicy = (policy: any) => {
    if (isAiAssistantEnabled) {
      onSelectEditPolicyAI(policy)
    } else {
      setSelectedPolicyToEdit(policy)
      setSelectedSchemaAndTable({ schema: policy.schema, table: policy.table })
    }
  }

  const onSelectDeletePolicy = (policy: any) => {
    setSelectedPolicyToDelete(policy)
  }

  const onSavePolicySuccess = useCallback(async () => {
    ui.setNotification({ category: 'success', message: 'Policy successfully saved!' })
    closePolicyEditorModal()
  }, [closePolicyEditorModal])

  // Methods that involve some API
  const onToggleRLS = async () => {
    const payload = {
      id: selectedTableToToggleRLS.id,
      rls_enabled: !selectedTableToToggleRLS.rls_enabled,
    }

    const res: any = await meta.tables.update(payload.id, payload)
    if (res.error) {
      return ui.setNotification({
        category: 'error',
        message: `Failed to toggle RLS: ${res.error.message}`,
      })
    }

    await queryClient.invalidateQueries(tableKeys.list(ref, selectedTableToToggleRLS.schema))
    closeConfirmModal()
  }

  const onCreatePolicy = useCallback(async (payload: any) => {
    const res = await meta.policies.create(payload)
    if (res.error) {
      ui.setNotification({
        category: 'error',
        message: `Error adding policy: ${res.error.message}`,
      })
      return true
    }
    return false
  }, [])

  const onUpdatePolicy = async (payload: any) => {
    const res = await meta.policies.update(payload.id, payload)
    if (res.error) {
      ui.setNotification({
        category: 'error',
        message: `Error updating policy: ${res.error.message}`,
      })
      return true
    }
    return false
  }

  const onDeletePolicy = async () => {
    const res = await meta.policies.del(selectedPolicyToDelete.id)
    if (typeof res !== 'boolean' && res.error) {
      ui.setNotification({
        category: 'error',
        message: `Error deleting policy: ${res.error.message}`,
      })
    } else {
      ui.setNotification({ category: 'success', message: 'Successfully deleted policy!' })
    }
    closeConfirmModal()
  }

  return (
    <>
      {tables.length > 0 ? (
        tables.map((table: any) => (
          <section key={table.id}>
            <PolicyTableRow
              table={table}
              isLocked={isLocked}
              onSelectToggleRLS={onSelectToggleRLS}
              onSelectCreatePolicy={onSelectCreatePolicy}
              onSelectEditPolicy={onSelectEditPolicy}
              onSelectDeletePolicy={onSelectDeletePolicy}
            />
          </section>
        ))
      ) : hasTables ? (
        <NoSearchResults />
      ) : (
        <div className="flex-grow">
          <ProductEmptyState
            size="large"
            title="Row-Level Security (RLS) Policies"
            ctaButtonLabel="Create a table"
            infoButtonLabel="What is RLS?"
            infoButtonUrl="https://supabase.com/docs/guides/auth/row-level-security"
            onClickCta={() => router.push(`/project/${ref}/editor`)}
          >
            <div className="space-y-4">
              <InformationBox
                title="What are policies?"
                icon={<IconHelpCircle strokeWidth={2} />}
                description={
                  <div className="space-y-2">
                    <p className="text-sm">
                      Policies restrict, on a per-user basis, which rows can be returned by normal
                      queries, or inserted, updated, or deleted by data modification commands.
                    </p>
                    <p className="text-sm">
                      This is also known as Row-Level Security (RLS). Each policy is attached to a
                      table, and the policy is executed each time its accessed.
                    </p>
                  </div>
                }
              />
              <p className="text-sm text-foreground-light">
                Create a table in this schema first before creating a policy.
              </p>
            </div>
          </ProductEmptyState>
        </div>
      )}

      <PolicyEditorModal
        visible={!isEmpty(selectedSchemaAndTable)}
        roles={roles}
        schema={selectedSchemaAndTable.schema}
        table={selectedSchemaAndTable.table}
        selectedPolicyToEdit={selectedPolicyToEdit}
        onSelectCancel={closePolicyEditorModal}
        onCreatePolicy={onCreatePolicy}
        onUpdatePolicy={onUpdatePolicy}
        onSaveSuccess={onSavePolicySuccess}
      />

      <ConfirmModal
        danger
        visible={!isEmpty(selectedPolicyToDelete)}
        title="Confirm to delete policy"
        description={`This is permanent! Are you sure you want to delete the policy "${selectedPolicyToDelete.name}"`}
        buttonLabel="Delete"
        buttonLoadingLabel="Deleting"
        onSelectCancel={closeConfirmModal}
        onSelectConfirm={onDeletePolicy}
      />

      <ConfirmModal
        danger={selectedTableToToggleRLS.rls_enabled}
        visible={!isEmpty(selectedTableToToggleRLS)}
        title={`Confirm to ${selectedTableToToggleRLS.rls_enabled ? 'disable' : 'enable'} RLS`}
        description={`Are you sure you want to ${
          selectedTableToToggleRLS.rls_enabled ? 'disable' : 'enable'
        } row level security for the table "${selectedTableToToggleRLS.name}"?`}
        buttonLabel="Confirm"
        buttonLoadingLabel="Saving"
        onSelectCancel={closeConfirmModal}
        onSelectConfirm={onToggleRLS}
      />
    </>
  )
}

export default observer(Policies)
