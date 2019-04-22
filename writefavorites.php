<?php
file_put_contents(__DIR__ . '/data/' . $_COOKIE['username'] . '.json', file_get_contents('php://input'));
?>