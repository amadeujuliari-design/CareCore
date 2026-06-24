from routers.atividades import (
    convivente_elegivel_atividade,
    metodo_presenca_eh_digital,
    pode_desfazer_presenca,
)


class PresencaFake:
    def __init__(self, *, cancelado=False, usuario_id="u1", registrado_em=None):
        from datetime import datetime

        self.cancelado = cancelado
        self.usuario_id = usuario_id
        self.registrado_em = registrado_em or datetime(2026, 6, 24, 10, 0, 0)


def test_convivente_elegivel_atividade():
    class Conv:
        status = "Ativo"

    class ConvAcolhimento:
        status = "Em acolhimento"

    class ConvAusencia:
        status = "Ausência justificada"

    assert convivente_elegivel_atividade(Conv()) is True
    assert convivente_elegivel_atividade(ConvAcolhimento()) is True
    assert convivente_elegivel_atividade(ConvAusencia()) is False
    assert convivente_elegivel_atividade(None) is False


def test_metodo_presenca_eh_digital():
    assert metodo_presenca_eh_digital("QR Code") is True
    assert metodo_presenca_eh_digital("Manual") is False


def test_pode_desfazer_presenca_no_prazo():
    from datetime import datetime, timedelta

    registrado = datetime(2026, 6, 24, 10, 0, 0)
    presenca = PresencaFake(usuario_id="u1", registrado_em=registrado)
    agora = registrado + timedelta(seconds=30)
    assert pode_desfazer_presenca(presenca, "u1", agora=agora) is True


def test_pode_desfazer_presenca_fora_prazo():
    from datetime import datetime, timedelta

    registrado = datetime(2026, 6, 24, 10, 0, 0)
    presenca = PresencaFake(usuario_id="u1", registrado_em=registrado)
    agora = registrado + timedelta(minutes=2)
    assert pode_desfazer_presenca(presenca, "u1", agora=agora) is False
