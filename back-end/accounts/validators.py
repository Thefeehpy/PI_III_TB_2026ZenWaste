import re


def normalize_cnpj(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def format_cnpj(value: str) -> str:
    digits = normalize_cnpj(value)[:14]
    if len(digits) != 14:
        return digits
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"


def validate_cnpj(value: str) -> bool:
    digits = normalize_cnpj(value)
    if len(digits) != 14 or digits == digits[0] * 14:
        return False

    def calculate(slice_value: str, weights: list[int]) -> int:
        total = sum(int(digit) * weight for digit, weight in zip(slice_value, weights, strict=True))
        rest = total % 11
        return 0 if rest < 2 else 11 - rest

    first_digit = calculate(digits[:12], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    second_digit = calculate(digits[:12] + str(first_digit), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])

    return int(digits[12]) == first_digit and int(digits[13]) == second_digit
