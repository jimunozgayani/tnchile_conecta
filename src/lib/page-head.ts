// Per-route head metadata helper.
// Keeps titles/descriptions unique per page and adds a self-referencing canonical.

const BASE_URL = "https://tnchile-proveedores.lovable.app";

export function pageHead(path: string, title: string, description: string) {
  const url = `${BASE_URL}${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
