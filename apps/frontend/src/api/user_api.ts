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