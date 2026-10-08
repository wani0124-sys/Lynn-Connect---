import { z } from "zod"

// 회원가입은 회사 메일만 받는다(2026-10-08 사용자 결정). 아이디만 입력받고 이 도메인을 붙인다.
export const SIGNUP_EMAIL_DOMAIN = "wm.co.kr"

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "이름을 입력하세요."),
    emailId: z
      .string()
      .trim()
      .min(1, "아이디를 입력하세요.")
      .regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문, 숫자, . _ - 만 쓸 수 있습니다."),
    password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다."),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요."),
    role: z.enum(["manager", "member"], { message: "구분을 선택하세요." }),
    siteId: z.number().nullable(),
    mailSiteId: z.number().nullable(),
    position: z.string().trim().nullable(),
    department: z.string().trim().nullable(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role !== "member" || data.siteId !== null || data.mailSiteId !== null, {
    message: "현장관리자는 소속 현장을 하나 이상 고르세요.",
    path: ["siteId"],
  })

export type SignupInput = z.infer<typeof signupSchema>
