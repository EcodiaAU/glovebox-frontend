import { BrowserRouter, Routes, Route } from "react-router";
import { AuthProvider } from "@/lib/supabase/auth";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";
import { SyncBootstrap } from "@/components/auth/SyncBootstrap";
import { BasemapBootstrap } from "@/components/native/BasemapBootstrap";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EnterTransition } from "@/components/brand/EnterTransition";
import { AppLayout } from "./app/(app)/layout";
import { LegalLayout } from "./app/(legal)/layout";
import { Suspense, lazy } from "react";
import GlobalError from "./app/error";
import AppError from "./app/(app)/error";

// ── Loading skeletons (imported eagerly for instant fallbacks) ──────────
import { NewTripSkeleton } from "./app/(app)/new/NewTripSkeleton";
import LiveLoading from "./app/(app)/live/loading";
import LoginLoading from "./app/(app)/login/loading";
import UntetheredLoading from "./app/(app)/untethered/loading";

// ── Lazy-loaded page components ────────────────────────────────────────
const LandingPage = lazy(() => import("./app/ClientPage"));

// Glovebox is ONE page: the trip surface. There is no tab bar and no
// PersistentTabs shell any more, so the pages are plain lazy routes again.
// /sos stays a route rather than a modal because on the web a URL is free: it is
// deep-linkable and the back button works. It is reached from a persistent button
// on the trip page, never from a tab. /guide is gone - the co-pilot is the
// floating Friend chat mounted in AppLayout.
const LoginPage = lazy(() => import("./app/(app)/login/page"));
const AuthCallbackPage = lazy(() => import("./app/(app)/auth/callback/page"));
const UntetheredPage = lazy(() => import("./app/(app)/untethered/page"));
const LiveTripClientPage = lazy(() => import("./app/(app)/live/ClientPage"));
const NewTripPage = lazy(() => import("./app/(app)/new/page"));
const AccountPage = lazy(() => import("./app/(app)/account/page"));
const TripClientPage = lazy(() => import("./app/(app)/trip/ClientPage").then((m) => ({ default: m.TripClientPage })));
const EmergencyClientPage = lazy(() => import("./app/(app)/sos/ClientPage"));

// Legal routes
const AttributionsPage = lazy(() => import("./app/(legal)/attributions/page"));
const ContactPage = lazy(() => import("./app/(legal)/contact/page"));
const PrivacyPage = lazy(() => import("./app/(legal)/privacy/page"));
const TermsPage = lazy(() => import("./app/(legal)/terms/page"));

// Standalone routes
const PurchaseSuccessPage = lazy(() => import("./app/purchase/success/page"));
const ComingSoonPage = lazy(() => import("./app/coming-soon/page"));
// Public, login-free map embed iframed by the Ecosphere connector.
const EmbedPage = lazy(() => import("./app/(app)/embed/ClientPage"));

// Catch-all
const NotFoundClient = lazy(() =>
  import("@/components/ui/NotFoundClient").then((m) => ({ default: m.NotFoundClient }))
);

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallback={(props) => <GlobalError {...props} />}>
        <AuthProvider>
          <ServiceWorkerRegistration />
          <NativeBootstrap />
          <SyncBootstrap />
          <BasemapBootstrap />
          <Routes>
            {/* Landing */}
            <Route
              index
              element={
                <Suspense fallback={null}>
                  <LandingPage />
                </Suspense>
              }
            />

            {/* App shell routes */}
            <Route element={<ErrorBoundary fallback={(props) => <AppError {...props} />}><AppLayout /></ErrorBoundary>}>
            {/* The single page, plus SOS as a deep-linkable route reached from a button on it. */}
            <Route path="trip" element={<TripClientPage initialPlanId={null} />} />
            <Route path="sos" element={<EmergencyClientPage />} />

            {/* Non-tab app routes */}
            <Route
              path="live"
              element={
                <Suspense fallback={<LiveLoading />}>
                  <LiveTripClientPage />
                </Suspense>
              }
            />
            <Route
              path="login"
              element={
                <Suspense fallback={<LoginLoading />}>
                  <LoginPage />
                </Suspense>
              }
            />
            <Route
              path="new"
              element={
                <Suspense fallback={<NewTripSkeleton />}>
                  <NewTripPage />
                </Suspense>
              }
            />
            <Route
              path="untethered"
              element={
                <Suspense fallback={<UntetheredLoading />}>
                  <UntetheredPage />
                </Suspense>
              }
            />
            <Route
              path="account"
              element={
                <Suspense fallback={null}>
                  <AccountPage />
                </Suspense>
              }
            />
            <Route
              path="auth/callback"
              element={
                <Suspense fallback={null}>
                  <AuthCallbackPage />
                </Suspense>
              }
            />
          </Route>

          {/* Legal routes */}
          <Route element={<LegalLayout />}>
            <Route
              path="attributions"
              element={
                <Suspense fallback={null}>
                  <AttributionsPage />
                </Suspense>
              }
            />
            <Route
              path="contact"
              element={
                <Suspense fallback={null}>
                  <ContactPage />
                </Suspense>
              }
            />
            <Route
              path="privacy"
              element={
                <Suspense fallback={null}>
                  <PrivacyPage />
                </Suspense>
              }
            />
            <Route
              path="terms"
              element={
                <Suspense fallback={null}>
                  <TermsPage />
                </Suspense>
              }
            />
          </Route>

          {/* Standalone routes */}
          <Route
            path="purchase/success"
            element={
              <Suspense fallback={null}>
                <PurchaseSuccessPage />
              </Suspense>
            }
          />
          <Route
            path="coming-soon"
            element={
              <Suspense fallback={null}>
                <ComingSoonPage />
              </Suspense>
            }
          />
          <Route
            path="embed"
            element={
              <Suspense fallback={null}>
                <EmbedPage />
              </Suspense>
            }
          />

          {/* 404 catch-all */}
          <Route
            path="*"
            element={
              <Suspense fallback={null}>
                <NotFoundClient />
              </Suspense>
            }
          />
          </Routes>
          <EnterTransition />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
