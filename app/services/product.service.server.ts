// Service goi shopify admin api

import { authenticate } from "app/shopify.server";

type ProductNode = {
  id: string;
  title: string;
  tags: string[];
};

export const searchProducts = async (
  request: Request,
  q: string,
  first: number = 20,
): Promise<ProductNode[]> => {
  const query = q?.trim();
  if (!query || query.length < 2) {
    throw new Error("Query must be at least 2 characters");
  }

  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
    query($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        nodes { id title tags }
      }
    }`,
    { variables: { query: `title:*${query}*`, first } },
  );

  const json = (await response.json()) as {
    data: { products: { nodes: ProductNode[] } };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error("GraphQL error.");
  }

  return json.data.products.nodes;
};

export const addTagToProduct = async (
  request: Request,
  productId: string,
  tag: string,
) => {
  return updateTags(request, productId, (tags) => {
    if (!tag.trim()) throw new Error("Tag cannot be empty");
    if (!tags.includes(tag)) tags.push(tag);
    return tags;
  });
};

export const removeTagFromProduct = async (
  request: Request,
  productId: string,
  tag: string,
) => {
  return updateTags(request, productId, (tags) => {
    return tags.filter((t) => t !== tag);
  });
};

const updateTags = async (
  request: Request,
  productId: string,
  callNext: (current: string[]) => string[],
) => {
  const { admin } = await authenticate.admin(request);
  const getRes = await admin.graphql(
    `#graphql
        query($id: ID!) {
        product(id: $id) { id tags }
    }`,
    { variables: { id: productId } },
  );

  const getJson = await getRes.json();
  const current: string[] = getJson.data.product.tags ?? [];
  const next = callNext(current);

  const updRes = await admin.graphql(
    `#graphql
    mutation($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node {... on Product { id tags }}
        userErrors { field message }
      }
    }`,
    { variables: { input: { id: productId, tags: next } } },
  );

  const upJson = (await updRes.json()) as {
    data?: any;
    errors?: { message: string }[];
  };
  const result = upJson?.data?.productUpdate;

  if (upJson?.errors?.length) {
    throw new Error("GraphQL error.");
  }
  if (result?.userErrors[0].message) {
    throw Error(result.userErrors[0].message);
  }
  return result?.product;
};
