export type AdminDashboardFeedback = {
  message: string;
  isSuccess: boolean;
};

type AdminDashboardActiveMessageArgs = {
  candidateMessage: AdminDashboardFeedback | null;
  userMessage: AdminDashboardFeedback | null;
  isCandidateModalOpen: boolean;
  isUserModalOpen: boolean;
};

export const getAdminDashboardActiveFeedback = ({
  candidateMessage,
  userMessage,
  isCandidateModalOpen,
  isUserModalOpen,
}: AdminDashboardActiveMessageArgs) => {
  if (isUserModalOpen) return userMessage;
  if (isCandidateModalOpen) return candidateMessage;
  return userMessage || candidateMessage;
};
