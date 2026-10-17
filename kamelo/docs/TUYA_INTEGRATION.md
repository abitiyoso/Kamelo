# Kamelo Smart — optional IoT and Tuya integration

The current application supports persistent **mock devices only**. Smart IoT pages explicitly identify simulation; mock commands never control physical hardware. Core room, occupant, reservation, billing, and payment workflows do not require IoT.

The current change set adds simulated room-access lifecycle management and encrypted demonstration PINs. Integration and regression validation of this addition is pending. It does not establish real smart-lock support or a physical unlocking capability.

## Provider contract

`lib/iot.ts` defines `IoTProvider` with:

```typescript
listDevices(): Promise<SmartDevice[]>
getDeviceStatus(id: string): Promise<SmartDevice>
getDeviceCapabilities(id: string): Promise<SmartDevice['capabilities']>
sendDeviceCommand(id: string, command: Command): Promise<SmartDevice>
syncDevices(): Promise<SmartDevice[]>
```

`SmartDevice` carries an ID, online state, capability descriptions, and confirmed state. `Command` contains a capability code and a boolean or number value. The capability vocabulary supports booleans and bounded integer values. The mock access capability is an application simulation; it does not model verified Tuya lock credential functions, arbitrary product datapoints, or a real lock API.

`MockTuyaProvider` implements all five methods over supplied simulation records. `TuyaCloudProvider` implements the interface but every method throws an explicit unconfigured/unverified error. It is a deliberate disabled adapter, not a partially functioning live integration. There are no Tuya API requests, region assumptions, credentials, token refresh, device linking, or encrypted credential storage in the current code.

## Implemented simulation workflow

1. An owner creates a simulated device from Smart IoT. Its `Device` row has `provider=MOCK`, an explicit device kind, declared mock capabilities, and simulated initial state. The baseline light uses the boolean `power` capability; a lock uses the separately declared simulated access capability.
2. The owner maps the device to a room in the same property. The server rejects cross-property room/device mappings.
3. Controls are rendered from the device's capabilities. Offline devices and unsupported values are rejected by `validateCommand` on the server.
4. A supported mock command returns the simulated confirmed state. The transaction updates the stored state and `syncedAt` only after confirmation and writes `MOCK_COMMAND_CONFIRMED` to the audit log.
5. The portal reloads persisted state. On an offline or capability rejection, the previously confirmed state remains unchanged. `MOCK_COMMAND_FAILED` is committed with the attempted capability code before returning HTTP 400; failed state is not presented as success.

Device creation and mapping are owner-only. Staff device control defaults to denied and can be explicitly granted or revoked by an owner through `canControlDevices`. A grant permits supported simulation controls only within the staff member's assigned properties; live commands remain blocked. Changing staff permissions revokes their sessions. Mutations require an authenticated same-origin request, organization/property access, and the management rate limit. Device mapping and creation are also audited.

The UI distinguishes a pending request from the resulting confirmed state, but the mock completes synchronously. The database does not currently persist a dedicated requested/pending/confirmed/failed command lifecycle or provide a command-history page. The audit log records confirmed and failed mock attempts; it is not a substitute for a future asynchronous live command lifecycle. Public demo controls are read-only.

## Optional simulated room-access workflow

An owner maps a mock lock to a room and explicitly enables access automation. `SmartAccess` records a device/stay pair and its scheduled, pending, active, or revoked state. A future stay remains scheduled. Kos requires an active stay within its date range; hotel additionally requires check-in. Check-out, end date, disabled automation, or remapping/unmapping requests revocation. Access follows stay state and dates, never invoice payment status; no rent-based lockout is implemented.

Only an online mock lock with the supported boolean access capability can confirm the simulated outcome. Offline or failed changes leave the last confirmed device state intact and access pending, including pending revocation when a device has not confirmed it. The application does not present a pending command as a completed device action. Reconciliation occurs during related application mutations and authorized access refreshes. It is not an always-running scheduler and cannot guarantee unattended real-device date transitions.

Each device/stay access record has a random six-digit demonstration PIN encrypted with AES-256-GCM. Plaintext PINs are excluded from device-state JSON and audit entries. A tenant can see one only through an unexpired invoice link with `includeAccess`, for the same stay/room/property, within valid dates, eligible stay status, enabled automation, online device, and confirmed active simulation. Links created without the necessary owner/device-control authority remain invoice-only. Ended, offline, revoked, pending, or mismatched access does not reveal an active credential.

Hosted instances require a protected 32-byte `DATA_ENCRYPTION_KEY` encoded as 64 hex characters. Only loopback development permits a private persisted fallback key in `.local-secrets/data-key`. This encrypts simulation PINs, not Tuya cloud account credentials. The current application still has no live Tuya credential vault, cloud linking, token refresh, or real-device command lifecycle.

These PINs are demonstration values, not usable room keys. The simulation does not physically unlock a door, provision a Tuya credential, or assert compatibility with an unspecified lock model.

## Requirements before enabling live Tuya

Live support remains blocked by external service and hardware dependencies. An implementation must first establish:

- A permitted Tuya connection/linking flow appropriate for assisted customer onboarding.
- Verified cloud project, region, subscribed API service, account permissions, and commercial cost.
- Real test devices and confirmed product-specific status/function schemas from the relevant official documentation and actual capability discovery.
- Server-only credentials with encryption at rest, access restriction, rotation, and safe logging.
- Token acquisition/refresh, timeout and retry policy, rate-limit handling, authentication errors, offline/stale states, and synchronization strategy.
- Persisted requested/pending/confirmed/failed command outcomes with reconciliation against actual device status; never assume a request acceptance proves a physical action.
- End-to-end tests against the selected devices, plus organization isolation, owner authorization, mapping isolation, unsupported functions, and failure recovery.
- Validated independent IoT entitlement and pricing. No fixed IoT price is currently advertised.

Do not guess Tuya regions, datapoint codes, device compatibility, or lock commands from any mock capability. Real smart-lock credential provisioning and automatic physical unlocking are unavailable. Live access support requires explicit authorization, product-specific supported access methods, verified expiry/revocation semantics, status reconciliation, and safety/recovery handling. Compatibility and API calls must be based on current official Tuya documentation for the verified service when live integration is implemented.

## Validation

Previous-release domain tests cover supported boolean/integer command validation, unsupported codes/ranges, and offline rejection. Its 15 integration scenario groups included persistent mock creation, same-property mapping, command confirmation audit, default staff denial followed by an explicit control grant, cross-property denial, session revocation, and preservation of state on offline failure.

The integrated tenant/smart suite passed scheduling, hotel check-in/out, disabled automation, remapping, offline pending activation/revocation, scoped tenant disclosure, encrypted PIN storage and independence from payment status. Browser checks verified simulated creation and disable/revocation. Owner/staff management GET also reconciles mapped mock-lock dates so its panel does not wait for a tenant visit. No continuously running scheduler or live Tuya operation has been tested. See [implementation status](IMPLEMENTATION_STATUS.md).

Official references for future verified live lock work: [door lock API services](https://developer.tuya.com/en/docs/cloud/doorlock-api-refer?id=Kbe2mbiqn5mik), [lock capabilities](https://developer.tuya.com/en/docs/iot/lock?id=K9wjnt8v958nh), and [hotel door locks](https://developer.tuya.com/en/docs/wisdombussiness/hotel-door-lock?id=Kaggqxyfanhwi). These are references, not evidence that a particular service/device is connected here.
