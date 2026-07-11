import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// core-api's shared supabase client reads this global at module init to use
// AsyncStorage for auth session persistence (RN has no localStorage, so
// without it every app restart logs the user out). It must be set BEFORE
// App (and thus core-api) is loaded — hence require() instead of a hoisted
// static import.
(globalThis as any).__VINYLA_SUPABASE_STORAGE__ = AsyncStorage;

// core-api's external API calls go through the key-holding Next.js proxy;
// on RN the proxy isn't same-origin, so expose its base URL the same way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getApiBaseUrl } = require('./src/utils/apiConfig');
(globalThis as any).__VINYLA_API_BASE__ = getApiBaseUrl();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
