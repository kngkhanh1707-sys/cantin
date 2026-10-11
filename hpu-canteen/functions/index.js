import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

const auth = getAuth();
const db = getFirestore();
const supportedRoles = new Set(['customer', 'staff', 'kitchen', 'cashier', 'admin']);

async function requireAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập bằng tài khoản admin.');
  }

  const claims = request.auth.token;
  if (claims.role === 'admin' || claims.admin === true) return;

  const profile = await db.collection('users').doc(request.auth.uid).get();
  if (profile.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Chỉ admin mới được quản lý tài khoản.');
  }
}

function validateProfile(data) {
  const displayName = String(data.displayName || '').trim();
  const studentId = String(data.studentId || '').trim();
  const phone = String(data.phone || '').trim();
  const role = String(data.role || '');

  if (!displayName || displayName.length > 100) {
    throw new HttpsError('invalid-argument', 'Họ tên phải có từ 1 đến 100 ký tự.');
  }
  if (studentId.length > 50 || phone.length > 30) {
    throw new HttpsError('invalid-argument', 'Mã sinh viên hoặc số điện thoại quá dài.');
  }
  if (!supportedRoles.has(role)) {
    throw new HttpsError('invalid-argument', 'Vai trò tài khoản không hợp lệ.');
  }

  return { displayName, studentId, phone, role };
}

async function setAccountRole(uid, role) {
  const account = await auth.getUser(uid);
  const claims = { ...account.customClaims };
  delete claims.role;
  delete claims.admin;
  delete claims.staff;
  if (role !== 'customer') claims.role = role;
  if (role === 'staff' || role === 'kitchen' || role === 'cashier') claims.staff = true;
  if (role === 'admin') claims.admin = true;
  await auth.setCustomUserClaims(uid, claims);
}

export const createManagedAccount = onCall(async (request) => {
  await requireAdmin(request);

  const data = request.data || {};
  const profile = validateProfile(data);
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!email || email.length > 254) {
    throw new HttpsError('invalid-argument', 'Email không hợp lệ.');
  }
  if (password.length < 8 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 8 ký tự.');
  }

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: profile.displayName,
    disabled: false,
  });

  await setAccountRole(userRecord.uid, profile.role);
  await db.collection('users').doc(userRecord.uid).set({
    ...profile,
    email,
    enabled: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { uid: userRecord.uid };
});

export const updateManagedAccount = onCall(async (request) => {
  await requireAdmin(request);

  const data = request.data || {};
  const uid = String(data.uid || '');
  if (!uid) throw new HttpsError('invalid-argument', 'Thiếu UID tài khoản.');
  const profile = validateProfile(data);
  const enabled = data.enabled !== false;
  if (uid === request.auth.uid && (profile.role !== 'admin' || !enabled)) {
    throw new HttpsError('failed-precondition', 'Không thể tự hạ quyền hoặc khóa tài khoản admin đang đăng nhập.');
  }

  const account = await auth.getUser(uid);

  await auth.updateUser(uid, {
    displayName: profile.displayName,
    disabled: !enabled,
  });
  if (account.customClaims?.role !== profile.role
    || account.customClaims?.admin !== (profile.role === 'admin')
    || account.customClaims?.staff !== ['staff', 'kitchen', 'cashier'].includes(profile.role)) {
    await setAccountRole(uid, profile.role);
  }
  await db.collection('users').doc(uid).set({
    ...profile,
    email: account.email || '',
    enabled,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return { uid };
});

export const deleteManagedAccount = onCall(async (request) => {
  await requireAdmin(request);

  const uid = String((request.data || {}).uid || '');
  if (!uid) throw new HttpsError('invalid-argument', 'Thiếu UID tài khoản.');
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'Không thể xóa tài khoản admin đang đăng nhập.');
  }

  await auth.deleteUser(uid);
  await db.collection('users').doc(uid).delete();
  return { uid };
});
