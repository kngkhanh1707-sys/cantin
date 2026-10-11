import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const createAccount = httpsCallable(functions, 'createManagedAccount');
const updateAccount = httpsCallable(functions, 'updateManagedAccount');
const deleteAccount = httpsCallable(functions, 'deleteManagedAccount');

export async function createManagedAccount(account) {
  return createAccount(account);
}

export async function updateManagedAccount(account) {
  return updateAccount(account);
}

export async function deleteManagedAccount(uid) {
  return deleteAccount({ uid });
}
