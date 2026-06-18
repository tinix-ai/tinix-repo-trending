import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match both '/' and internationalized routes
  matcher: ["/", "/(vi|en)/:path*"],
};
