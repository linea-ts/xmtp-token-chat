interface GroupCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  groupName: string;
  setGroupName: (name: string) => void;
  groupMembers: string;
  setGroupMembers: (members: string) => void;
}

export const GroupCreationModal = ({
  isOpen,
  onClose,
  onSubmit,
  groupName,
  setGroupName,
  groupMembers,
  setGroupMembers,
}: GroupCreationModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">Create Group Chat</h2>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group Name"
            className="w-full p-2 mb-4 border rounded"
            required
          />
          <textarea
            value={groupMembers}
            onChange={(e) => setGroupMembers(e.target.value)}
            placeholder="Member addresses (comma separated)"
            className="w-full p-2 mb-4 border rounded h-24"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 