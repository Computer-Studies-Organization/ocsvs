import axios from "axios";


export const api = axios.create({
  baseURL: "http://localhost:8787",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
      delete config.headers["Content-Type"]
  }
  else {
      config.headers["Content-Type"] = "application/json"
  }
  return config
})