// The shared welcome page for clients and staff, at its own address.
// "/" also matches the client and staff home screens (route groups add no path), so signed-out
// redirects from inside those groups must point here rather than at "/".
export { default } from './index';
