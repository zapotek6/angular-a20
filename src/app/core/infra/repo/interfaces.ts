export interface Converter<DTO, MODEL> {
  fromDto(dto: DTO): MODEL;
  toDto(model: MODEL): DTO;
}
