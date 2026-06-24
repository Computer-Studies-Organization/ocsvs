interface ErrorWithResponse {
  response?: {
    data?: {
      message?: unknown;
    };
  };
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const { response } = error as ErrorWithResponse;
    if (response?.data?.message && typeof response.data.message === "string") {
      return response.data.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
