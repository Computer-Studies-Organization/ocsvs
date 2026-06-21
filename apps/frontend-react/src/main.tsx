import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { configureUnauthorizedRedirect } from "./lib/authRedirect";
import { routeTree } from "./routeTree.gen";

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

const queryClient = new QueryClient();

configureUnauthorizedRedirect({
  getCurrentPathname: () => router.state.location.pathname,
  navigate: ({ replace, to }) => router.navigate({ replace, to }),
  setQueryData: (key, value) => {
    queryClient.setQueryData(key, value);
  },
});

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
