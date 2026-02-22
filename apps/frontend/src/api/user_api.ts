import { TLoginUser, TRegisterUser } from "@/@types";
import { api } from "./axios";


export const registerUser = async (data: TRegisterUser) => {
    const response = await api.post("/register", data)
    return response.data
}

export const loginUser = async (data: TLoginUser) => {
    const response = await api.post("/login", data)
    return response.data
}

export const logoutUser = async () => {
    const response = await api.post("/logout")
    return response.data
}

export const authMe = async () => {
    const response = await api.get("/me");
    return response.data
}

export const fetchUsers = async (page: number = 1, limit: number = 100) => {
    const response = await api.get(`/users?page=${page}&limit=${limit}`);
    return response.data
}