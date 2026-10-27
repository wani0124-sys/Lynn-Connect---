import { z } from "zod"

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// 설정 화면에서 본인이 직접 바꿀 때는 현재 비밀번호를 함께 확인한다.
export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력하세요."),
    newPassword: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "현재 비밀번호와 다른 비밀번호를 입력하세요.",
    path: ["newPassword"],
  })

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
