import { apiClient } from "./apiClient";

export async function fetchAllPages(path, params = {}) {
  const items = [];
  let page = 1;

  while (true) {
    const { data } = await apiClient.get(path, {
      params: { ...params, page, limit: 100 },
    });
    if (!Array.isArray(data.items)) {
      throw new Error(`The API response for ${path} did not contain an items list.`);
    }

    const total = Number(data.total);
    if (!Number.isFinite(total) || total < 0) {
      throw new Error(`The API response for ${path} did not contain a valid total.`);
    }

    if (total === 0) return [];

    items.push(...data.items);
    if (items.length >= total) return items;

    if (data.items.length === 0) {
      throw new Error(`The API returned no items before reaching the total for ${path}.`);
    }

    page += 1;
  }
}
