// A stable HTTP endpoint lets an already-open board survive new deployments.
export async function updateOrderStatus(id: string, status: string): Promise<{ error: string }> {
  const response = await fetch("/api/orders/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Unexpected status response");
  }
  const result = await response.json();
  if (!response.ok && !result.error) throw new Error("Status update failed");
  return result;
}
