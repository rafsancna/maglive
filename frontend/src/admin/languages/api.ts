import {
  languageDtoSchema,
  languageListDtoSchema,
  type CreateLanguageRequest,
  type LanguageDto,
  type LanguageListDto,
} from "@maglive/contracts";
import { requestAdminData, requestAdminMutation } from "../auth/api";

export function getLanguages(): Promise<LanguageListDto> {
  return requestAdminData("/admin/languages", languageListDtoSchema);
}

export function addLanguage(input: CreateLanguageRequest): Promise<LanguageDto> {
  return requestAdminMutation(
    "/admin/languages",
    languageDtoSchema,
    "POST",
    input,
  );
}
