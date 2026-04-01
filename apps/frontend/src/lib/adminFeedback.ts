type AdminDashboardActiveMessageArgs = {
  candidateMessage: string;
  userMessage: string;
  isCandidateModalOpen: boolean;
  isUserModalOpen: boolean;
};

export const getAdminDashboardActiveMessage = ({
  candidateMessage,
  userMessage,
  isCandidateModalOpen,
  isUserModalOpen,
}: AdminDashboardActiveMessageArgs) => {
  if (isUserModalOpen) return userMessage;
  if (isCandidateModalOpen) return candidateMessage;
  return userMessage || candidateMessage;
};
