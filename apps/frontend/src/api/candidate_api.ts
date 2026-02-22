import { api } from "./axios";
import { TCandidate } from "@/@types";

export const allCandidates = async () => {
    let allCandidatesData: TCandidate[] = []
    let page = 1
    const limit = 100
    let hasMore = true

    while (hasMore) {
        const response = await api.get("/candidates", {
            params: {
                page,
                limit
            }
        })
        
        const { data, meta } = response.data
        allCandidatesData = [...allCandidatesData, ...data]
        
        hasMore = page < meta.totalPages
        page++
    }

    return {
        data: allCandidatesData,
        meta: {
            total: allCandidatesData.length,
            page: 1,
            limit: allCandidatesData.length,
            totalPages: 1
        }
    }
}

export const createCandidate = async (data: Omit<TCandidate, "id">) => {
    const response = await api.post("/candidates", data)
    return response.data
}
