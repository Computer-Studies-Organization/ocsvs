import type { AppBindings, AppOpenAPI } from "@/lib/types/app-types";
import { Scalar } from "@scalar/hono-api-reference";
import { createMiddleware } from "hono/factory";
import packageJSON from "../../package.json";

const hideProductionDocumentation = createMiddleware<AppBindings>(async (c, next) => {
  if (c.env.NODE_ENV === "production") {
    return c.notFound();
  }

  await next();
});

export default function configureOpenAPI(app: AppOpenAPI) {
  app.use("/docs", hideProductionDocumentation);
  app.use("/reference", hideProductionDocumentation);

  app.doc("/docs", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Hono API",
    },
  });

  app.get(
    "/reference",
    Scalar({
      url: "/docs",
      pageTitle: "Hono API Documentation",
      layout: "classic", // classic or modern
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
      theme: "kepler", // alternate, kepler, dark, purple, moon, solarized, bluePlanet, saturn, deepSpace, mars, none
      // check scalar's official documentation for more options : https://guides.scalar.com/scalar/scalar-api-references/integrations/hono
    }),
  );
}
