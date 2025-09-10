import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  InlineStack,
} from "@shopify/polaris";
import {
  addTagToProduct,
  removeTagFromProduct,
  searchProducts,
} from "app/services/product.service.server";
import { authenticate } from "app/shopify.server";
import { useState } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ ok: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  try {
    if (intent === "search") {
      const q = String(form.get("q") || "");
      const products = await searchProducts(request, q, 20);
      return json({ ok: true, products });
    }
    if (intent === "add") {
      const productId = String(form.get("productId") || "");
      const tag = String(form.get("tag") || "");
      const product = await addTagToProduct(request, productId, tag);
      return json({ ok: true, product });
    }
    if (intent === "remove") {
      const productId = String(form.get("productId") || "");
      const tag = String(form.get("tag") || "");
      const product = await removeTagFromProduct(request, productId, tag);
      return json({ ok: true, product });
    }
    return json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
};

export default function ProductTagsPage() {
  const [q, setQ] = useState("");
  const [tagById, setTagById] = useState<Record<string, string>>({});
  useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<typeof action>();
  const mutateFetcher = useFetcher<typeof action>();

  const isSearching =
    searchFetcher.state !== "idle" &&
    searchFetcher.formData?.get("intent") === "search";
  const isMutating = mutateFetcher.state !== "idle";
  const products = (searchFetcher.data as any)?.products || [];

  return (
    <Page title="Search products & manage tags">
      <Card>
        <BlockStack gap="300">
          <searchFetcher.Form method="post">
            <input type="hidden" name="intent" value="search" />
            <input type="hidden" name="q" value={q} />
            <InlineStack gap="300" align="start">
              <TextField
                label="Query"
                value={q}
                onChange={setQ}
                autoComplete="off"
                placeholder="ex: shirt"
                labelHidden
              />
              <Button submit loading={isSearching} size="medium">
                Search
              </Button>
            </InlineStack>
          </searchFetcher.Form>

          {products.length > 0 && (
            <BlockStack gap="300">
              {products.map((p: any) => (
                <Card key={p.id}>
                  <BlockStack gap="200">
                    <div>
                      <strong>{p.title}</strong>
                    </div>
                    <div>Tags: {p.tags?.join(", ") || "—"}</div>
                    <mutateFetcher.Form method="post">
                      <input type="hidden" name="productId" value={p.id} />
                      <InlineStack gap="200">
                        <TextField label="Tag" name="tag" autoComplete="off" />
                        <Button submit loading={isMutating}>
                          Add
                        </Button>

                        <Button submit loading={isMutating} tone="critical">
                          Remove
                        </Button>
                      </InlineStack>
                    </mutateFetcher.Form>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
