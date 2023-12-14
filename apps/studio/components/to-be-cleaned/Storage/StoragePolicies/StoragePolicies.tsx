import { useParams } from 'common'
import { filter, find, get, isEmpty } from 'lodash'
import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { IconLoader } from 'ui'

import { PolicyEditorModal } from 'components/interfaces/Auth/Policies'
import { SYSTEM_ROLES } from 'components/interfaces/Database/Roles/Roles.constants'
import { useProjectContext } from 'components/layouts/ProjectLayout/ProjectContext'
import ConfirmModal from 'components/ui/Dialogs/ConfirmDialog'
import { useDatabaseRolesQuery } from 'data/database-roles/database-roles-query'
import { useBucketsQuery } from 'data/storage/buckets-query'
import { useStore } from 'hooks'
import { useStorageStore } from 'localStores/storageExplorer/StorageExplorerStore'
import { formatPoliciesForStorage } from '../Storage.utils'
import StoragePoliciesBucketRow from './StoragePoliciesBucketRow'
import StoragePoliciesEditPolicyModal from './StoragePoliciesEditPolicyModal'
import StoragePoliciesPlaceholder from './StoragePoliciesPlaceholder'

const StoragePolicies = () => {
  const { ui, meta } = useStore()
  const { ref: projectRef } = useParams()
  const { project } = useProjectContext()

  const storageStore = useStorageStore()
  const { loaded } = storageStore

  const { data } = useBucketsQuery({ projectRef })
  const buckets = data ?? []

  const { data: rolesData } = useDatabaseRolesQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const roles = (rolesData ?? []).filter((role) => SYSTEM_ROLES.includes(role.name))

  const [policies, setPolicies] = useState<any[]>([])
  const [selectedPolicyToEdit, setSelectedPolicyToEdit] = useState({})
  const [selectedPolicyToDelete, setSelectedPolicyToDelete] = useState<any>({})
  const [isEditingPolicyForBucket, setIsEditingPolicyForBucket] = useState<any>({})

  // Only use storage policy editor when creating new policies for buckets
  const showStoragePolicyEditor =
    isEmpty(selectedPolicyToEdit) &&
    !isEmpty(isEditingPolicyForBucket) &&
    get(isEditingPolicyForBucket, ['bucket'], '').length > 0

  const showGeneralPolicyEditor = !isEmpty(isEditingPolicyForBucket) && !showStoragePolicyEditor

  // Policies under storage.objects
  const storageObjectsPolicies = filter(policies, { table: 'objects' })
  const formattedStorageObjectPolicies = formatPoliciesForStorage(buckets, storageObjectsPolicies)
  const ungroupedPolicies = get(
    find(formattedStorageObjectPolicies, { name: 'Ungrouped' }),
    ['policies'],
    []
  )

  // Policies under storage.buckets
  const storageBucketPolicies = filter(policies, { table: 'buckets' })

  useEffect(() => {
    fetchPolicies()
  }, [])

  const fetchPolicies = async () => {
    if (meta) {
      await meta.policies.load()
      const storagePolicies =
        meta?.policies.list((policy: any) => policy.schema === 'storage') ?? []
      setPolicies(storagePolicies)
    }
  }

  const onSelectPolicyAdd = (bucketName = '', table = '') => {
    setSelectedPolicyToEdit({})
    setIsEditingPolicyForBucket({ bucket: bucketName, table })
  }

  const onSelectPolicyEdit = (policy: any, bucketName = '', table = '') => {
    setIsEditingPolicyForBucket({ bucket: bucketName, table })
    setSelectedPolicyToEdit(policy)
  }

  const onCancelPolicyEdit = () => {
    setIsEditingPolicyForBucket({})
  }

  const onSelectPolicyDelete = (policy: any) => setSelectedPolicyToDelete(policy)
  const onCancelPolicyDelete = () => setSelectedPolicyToDelete({})

  const onSavePolicySuccess = async () => {
    ui.setNotification({ category: 'success', message: 'Successfully saved policy!' })
    await fetchPolicies()
    onCancelPolicyEdit()
  }

  /*
    Functions that involve the CRUD for policies
    For each API call within the Promise.all, return true if an error occurred, else return false
  */
  const onCreatePolicies = async (payloads: any[]) => {
    return await Promise.all(
      payloads.map(async (payload) => {
        const res = await meta.policies.create(payload)
        if (res.error) {
          ui.setNotification({
            category: 'error',
            message: `Error adding policy: ${res.error.message}`,
          })
          return true
        }
        return false
      })
    )
  }

  const onCreatePolicy = async (payload: any) => {
    const res = await meta.policies.create(payload)
    if (res.error) {
      ui.setNotification({
        category: 'error',
        message: `Error adding policy: ${res.error.message}`,
      })
      return true
    }
    return false
  }

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
    const res: any = await meta.policies.del(selectedPolicyToDelete.id)
    if (res) {
      ui.setNotification({
        category: 'error',
        message: `Failed to delete policy: ${res.error.message}`,
      })
    } else {
      ui.setNotification({ category: 'success', message: 'Successfully deleted policy!' })
    }
    setSelectedPolicyToDelete({})
    await fetchPolicies()
  }

  return (
    <div className="flex min-h-full w-full flex-col">
      <h3 className="text-xl">Storage policies</h3>
      <p className="mt-2 text-sm text-foreground-light">
        Safeguard your files with policies that define the operations allowed for your users at the
        bucket level.
      </p>

      {!loaded ? (
        <div className="flex h-full items-center justify-center">
          <IconLoader className="animate-spin" size={16} />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {buckets.length === 0 && <StoragePoliciesPlaceholder />}

          {/* Sections for policies grouped by buckets */}
          {buckets.map((bucket) => {
            const bucketPolicies = get(
              find(formattedStorageObjectPolicies, { name: bucket.name }),
              ['policies'],
              []
            )
            return (
              <StoragePoliciesBucketRow
                key={bucket.name}
                table="objects"
                label={bucket.name}
                bucket={bucket}
                policies={bucketPolicies}
                onSelectPolicyAdd={onSelectPolicyAdd}
                onSelectPolicyEdit={onSelectPolicyEdit}
                onSelectPolicyDelete={onSelectPolicyDelete}
              />
            )
          })}

          <div className="!mb-4 w-full border-b border-gray-600" />
          <p className="text-sm text-foreground-light">
            You may also write policies for the tables under the storage schema directly for greater
            control
          </p>

          {/* Section for policies under storage.objects that are not tied to any buckets */}
          <StoragePoliciesBucketRow
            table="objects"
            label="Other policies under storage.objects"
            policies={ungroupedPolicies}
            onSelectPolicyAdd={onSelectPolicyAdd}
            onSelectPolicyEdit={onSelectPolicyEdit}
            onSelectPolicyDelete={onSelectPolicyDelete}
          />

          {/* Section for policies under storage.buckets */}
          <StoragePoliciesBucketRow
            table="buckets"
            label="Policies under storage.buckets"
            policies={storageBucketPolicies}
            onSelectPolicyAdd={onSelectPolicyAdd}
            onSelectPolicyEdit={onSelectPolicyEdit}
            onSelectPolicyDelete={onSelectPolicyDelete}
          />
        </div>
      )}

      {/* Only used for adding policies to buckets */}
      <StoragePoliciesEditPolicyModal
        visible={showStoragePolicyEditor}
        bucketName={isEditingPolicyForBucket.bucket}
        roles={roles}
        onSelectCancel={onCancelPolicyEdit}
        onCreatePolicies={onCreatePolicies}
        onSaveSuccess={onSavePolicySuccess}
      />

      {/* Adding policies to objets/buckets table or editting any policy uses the general policy editor */}
      <PolicyEditorModal
        visible={showGeneralPolicyEditor}
        schema="storage"
        roles={roles}
        table={isEditingPolicyForBucket.table}
        selectedPolicyToEdit={selectedPolicyToEdit}
        onSelectCancel={onCancelPolicyEdit}
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
        onSelectCancel={onCancelPolicyDelete}
        onSelectConfirm={onDeletePolicy}
      />
    </div>
  )
}

export default observer(StoragePolicies)
