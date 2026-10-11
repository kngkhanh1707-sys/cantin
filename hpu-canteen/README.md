# HPU Canteen

## Firebase Firestore

1. In Firebase Console, open project `quoc-71c8f` and create a Cloud Firestore database.
2. Deploy Firestore Rules from this directory:

	```powershell
	firebase login
	firebase deploy --only firestore:rules --project quoc-71c8f
	```

3. Account-management Cloud Functions require the Firebase project to use the Blaze (pay-as-you-go) plan, which can incur charges. After enabling billing in Firebase Console, deploy them separately:

	```powershell
	firebase deploy --only functions --project quoc-71c8f
	```

4. New registrations are saved as `customer`. An account can receive its role in either of these Firebase locations:
   - Firebase Authentication custom claims: `role: "admin"`, `"staff"`, `"kitchen"`, or `"cashier"` (or `admin: true` / `staff: true`). Assign claims only from a trusted Admin SDK environment, never from the browser. For example:

	```js
	const account = await getAuth().getUser(uid);
	await getAuth().setCustomUserClaims(uid, {
	  ...account.customClaims,
	  role: 'admin',
	});
	```

   - Firestore profile: in `users/{Firebase Auth UID}`, set the `role` field to `admin`, `staff`, `kitchen`, or `cashier`. Do not let ordinary users change this field. The deployed Firestore Rules enforce this; the app checks this profile when no admin/staff claim is present.

5. Customers, staff, and admins all sign in through the same `/login` page. Firebase Auth claims take precedence; otherwise, the app reads `users/{uid}.role` and routes admins/staff to `/admin`, while customers go to `/home`. After changing a role, sign out and sign in again. An admin can use **Món ăn → Nạp menu mẫu** once to initialize `menuItems` in Firestore.

6. In **Tài khoản**, admins can create accounts, edit profile fields and roles, disable accounts, or delete accounts. These privileged actions use the callable Functions in `functions/`; enable billing and deploy them before using the controls. An admin cannot disable or delete their own account.

Collections used by the app: `users`, `menuItems`, and `orders`. Customers can read active menu items and their own orders. Staff can read orders and update their status. Admins can manage menu items and orders. Firestore Security Rules enforce these permissions even if a user bypasses the UI.

## Development

```powershell
npm install
npm run dev
```

The remaining sections below describe the original Vite template.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
