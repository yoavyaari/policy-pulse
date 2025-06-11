import sys
import types
import os

# Ensure backend package is on the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Stub external dependencies so app.apis.projects can be imported without them
sys.modules.setdefault('supabase', types.ModuleType('supabase'))
sys.modules.setdefault('supabase.client', types.ModuleType('supabase.client'))
sys.modules['supabase.client'].Client = object
sys.modules.setdefault('postgrest.exceptions', types.SimpleNamespace(APIError=Exception))
# Stub documents dependency
stub_doc_mod = types.ModuleType('app.apis.documents.__init__')
stub_doc_mod.get_supabase_client = lambda: None
sys.modules['app.apis.documents'] = stub_doc_mod
sys.modules['app.apis.documents.__init__'] = stub_doc_mod

from app.apis.projects import flatten_json


def test_flatten_basic_dict():
    data = {'a': 1, 'b': {'c': 2, 'd': {'e': 3}}}
    expected = {'a': 1, 'b_c': 2, 'b_d_e': 3}
    assert flatten_json(data) == expected


def test_flatten_with_lists():
    data = {
        'numbers': [1, 2],
        'items': [
            {'x': 10},
            {'y': 20}
        ]
    }
    expected = {
        'numbers_0': 1,
        'numbers_1': 2,
        'items_0_x': 10,
        'items_1_y': 20
    }
    assert flatten_json(data) == expected


def test_flatten_scalar_with_parent_key():
    data = 'value'
    expected = {'root': 'value'}
    assert flatten_json(data, parent_key='root') == expected
