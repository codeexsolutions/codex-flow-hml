import sysgrafix from "@/shared/api/sysgrafix";

export interface ProfileUpdateData {
  nome: string;
  cargo: string;
  imagem?: string;
}

const ProfileService = {
  updateProfile: async (data: ProfileUpdateData) => {
    await sysgrafix.patch("/usuarios/alterar-dados", data);
  },
};

export default ProfileService;
